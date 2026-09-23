import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser, BuyerProfileDto, MeDto, UpdateProfileRequest } from '@zuund/shared';
import { E } from '../common/domain.exception';
import { isUniqueViolation } from '../common/prisma-errors';
import { toCar, toCity, toMe, toPublicUser } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '../generated/prisma/client';

const withProfile = { profile: { include: { city: true } } } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Strips secrets and serialises dates for the wire. */
  toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      role: user.role,
    };
  }

  async getMe(userId: string): Promise<MeDto> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, include: withProfile });
    if (!u) throw new NotFoundException();
    return toMe(u);
  }

  async updateProfile(userId: string, input: UpdateProfileRequest): Promise<MeDto> {
    if (input.cityId) {
      const city = await this.prisma.city.findFirst({
        where: { id: input.cityId, status: 'ACTIVE' },
      });
      if (!city) throw new BadRequestException('Unknown city');
    }
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    const phoneChanged = input.phone !== undefined && input.phone !== current?.phone;
    if (phoneChanged) {
      const holder = await this.prisma.user.findUnique({ where: { phone: input.phone } });
      if (holder && holder.id !== userId) throw E.PHONE_TAKEN();
    }
    let photoUrl: string | null | undefined;
    if (input.photoFileId === null) photoUrl = null;
    else if (input.photoFileId) {
      const f = await this.prisma.fileObject.findFirst({
        where: { id: input.photoFileId, uploaderId: userId },
      });
      if (!f) throw new BadRequestException('Unknown photo');
      if (!f.mimeType.startsWith('image/'))
        throw new BadRequestException('Profile photo must be an image');
      photoUrl = f.url;
    }
    const u = await this.prisma.user
      .update({
        where: { id: userId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          // A new number is unverified until confirmed by SMS code.
          ...(phoneChanged ? { phone: input.phone, phoneVerifiedAt: null } : {}),
          profile: {
            upsert: {
              create: {
                cityId: input.cityId ?? null,
                about: input.about ?? null,
                photoUrl: photoUrl ?? null,
              },
              update: {
                ...(input.cityId !== undefined ? { cityId: input.cityId } : {}),
                ...(input.about !== undefined ? { about: input.about } : {}),
                ...(photoUrl !== undefined ? { photoUrl } : {}),
              },
            },
          },
        },
        include: withProfile,
      })
      .catch((e: unknown) => {
        if (isUniqueViolation(e, 'phone')) throw E.PHONE_TAKEN();
        throw e;
      });
    return toMe(u);
  }

  /**
   * What one buyer may see of another. A user who has blocked, or been
   * blocked by, the viewer is not visible.
   */
  async getPublicProfile(viewerId: string, userId: string): Promise<BuyerProfileDto> {
    const u = await this.prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE' },
      include: {
        ...withProfile,
        buyingIntents: {
          where: { status: 'ACTIVE' },
          include: { car: true, city: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!u) throw new NotFoundException('User not found');

    const [low, high] = [viewerId, userId].sort();
    const connection =
      viewerId === userId
        ? null
        : await this.prisma.connection.findUnique({
            where: { userLowId_userHighId: { userLowId: low!, userHighId: high! } },
          });
    if (connection?.status === 'BLOCKED') throw new ForbiddenException('Not available');

    const [connectionCount, collectiveCount] = await Promise.all([
      this.prisma.connection.count({
        where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { recipientId: userId }] },
      }),
      this.prisma.collectiveMembership.count({ where: { userId, status: 'ACTIVE' } }),
    ]);

    return {
      user: toPublicUser(u, { about: true }),
      activeIntents: u.buyingIntents.map((i) => ({
        id: i.id,
        car: toCar(i.car),
        city: toCity(i.city),
        purchaseTimeline: i.purchaseTimeline,
        intentLevel: i.intentLevel,
      })),
      connection: connection
        ? { id: connection.id, status: connection.status, requesterId: connection.requesterId }
        : null,
      connectionCount,
      collectiveCount,
    };
  }
}

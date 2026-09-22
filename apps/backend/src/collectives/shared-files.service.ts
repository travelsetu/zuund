import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Page, PageQuery, ShareFileRequest, SharedFileDto } from '@zuund/shared';
import { toFile, toPublicUser } from '../common/mappers';
import { afterCursor, cursorOrder, decodeCursor, toPage } from '../common/pagination';
import { FilesService } from '../files/files.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CollectivesService } from './collectives.service';

const include = {
  sharer: { include: { profile: { include: { city: true } } } },
  file: true,
} as const;
type Row = Prisma.SharedFileGetPayload<{ include: typeof include }>;

/** Buyer-shared brochures, spec sheets, links. Not offers, not quotations. */
@Injectable()
export class SharedFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collectives: CollectivesService,
    private readonly files: FilesService,
  ) {}

  async share(
    userId: string,
    collectiveId: string,
    input: ShareFileRequest,
  ): Promise<SharedFileDto> {
    await this.collectives.requireActiveMember(collectiveId, userId);
    if (input.fileId) await this.files.requireOwned(input.fileId, userId);
    const row = await this.prisma.sharedFile.create({
      data: {
        collectiveId,
        sharerId: userId,
        type: input.type,
        title: input.title,
        description: input.description,
        fileId: input.type === 'LINK' ? null : input.fileId,
        url: input.type === 'LINK' ? input.url : null,
      },
      include,
    });
    return this.toDto(row);
  }

  async list(userId: string, collectiveId: string, q: PageQuery): Promise<Page<SharedFileDto>> {
    await this.collectives.requireActiveMember(collectiveId, userId);
    const rows = await this.prisma.sharedFile.findMany({
      where: { collectiveId, deletedAt: null, ...afterCursor(decodeCursor(q.cursor)) },
      include,
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    return toPage(rows, q.limit, (r) => this.toDto(r));
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.sharedFile.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException();
    if (row.sharerId !== userId) throw new ForbiddenException('Only the sharer can remove this');
    await this.prisma.sharedFile.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private toDto(r: Row): SharedFileDto {
    return {
      id: r.id,
      collectiveId: r.collectiveId,
      sharer: toPublicUser(r.sharer),
      type: r.type,
      title: r.title,
      description: r.description,
      file: r.file ? toFile(r.file) : null,
      url: r.url,
      createdAt: r.createdAt.toISOString(),
    };
  }
}

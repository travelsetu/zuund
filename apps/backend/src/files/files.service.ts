import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { extname, join, resolve } from 'node:path';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FileDto } from '@zuund/shared';
import { toFile } from '../common/mappers';
import type { Env } from '../config/env';
import type { FileObject } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Allowed uploads. Nothing executable, nothing that a browser would run. */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const ALLOWED_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.pdf',
  '.txt',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
]);

/**
 * Where uploads live. Production: a private S3 bucket (zuund-uploads) that only its
 * CloudFront distribution may read, and CloudFront only serves signed links. Dev and
 * tests: files under UPLOAD_DIR. Either way a file is only reached through
 * `GET /api/files/:id`, which checks that the caller may see it; S3 then answers
 * with a short-lived signed link instead of the bytes.
 */
@Injectable()
export class FilesService {
  private readonly dir: string;
  private readonly publicBase: string;
  private readonly s3: {
    client: S3Client;
    bucket: string;
    prefix: string;
    domain: string;
    keyPairId: string;
    privateKey: string;
  } | null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.dir = resolve(config.get('UPLOAD_DIR', { infer: true }));
    this.publicBase = config.get('PUBLIC_API_URL', { infer: true }).replace(/\/$/, '');
    this.s3 =
      config.get('STORAGE_DRIVER', { infer: true }) === 's3'
        ? {
            client: new S3Client({ region: config.get('S3_REGION', { infer: true })! }),
            bucket: config.get('S3_BUCKET', { infer: true })!,
            prefix: config.get('S3_PREFIX', { infer: true }),
            domain: config.get('CLOUDFRONT_DOMAIN', { infer: true })!,
            keyPairId: config.get('CLOUDFRONT_KEY_PAIR_ID', { infer: true })!,
            privateKey: Buffer.from(
              config.get('CLOUDFRONT_PRIVATE_KEY_B64', { infer: true })!,
              'base64',
            ).toString('utf8'),
          }
        : null;
  }

  async store(uploaderId: string, file: Express.Multer.File): Promise<FileDto> {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext))
      throw new BadRequestException('File type not allowed');
    if (!sniffMatches(file.mimetype, file.buffer))
      throw new BadRequestException('File content does not match its type');

    const id = randomUUID();
    const key = `${this.s3?.prefix ?? ''}${new Date().toISOString().slice(0, 10)}/${id}${ext}`;
    if (this.s3) {
      await this.s3.client.send(
        new PutObjectCommand({
          Bucket: this.s3.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ContentDisposition: disposition(file.mimetype, file.originalname),
          CacheControl: 'private, max-age=86400',
        }),
      );
    } else {
      await mkdir(join(this.dir, key.split('/')[0]!), { recursive: true });
      await writeFile(join(this.dir, key), file.buffer);
    }
    const row = await this.prisma.fileObject.create({
      data: {
        id,
        uploaderId,
        storageKey: key,
        url: `${this.publicBase}/api/files/${id}`,
        fileName: file.originalname.slice(0, 200),
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });
    return toFile(row);
  }

  /** A file may only be attached by the user who uploaded it. */
  async requireOwned(id: string, userId: string): Promise<FileObject> {
    const f = await this.prisma.fileObject.findFirst({ where: { id, uploaderId: userId } });
    if (!f) throw new NotFoundException('File not found');
    return f;
  }

  /**
   * Who may read a file: its uploader; anyone in a conversation it was sent
   * to; any ACTIVE member of a collective it was shared in; and anyone
   * signed in, for a profile photo. Otherwise 403, never a hint of existence.
   */
  async authorizeRead(id: string, userId: string): Promise<FileObject> {
    const f = await this.prisma.fileObject.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('File not found');
    if (f.uploaderId === userId) return f;

    const isPhoto = await this.prisma.userProfile.findFirst({
      where: { photoUrl: f.url },
      select: { id: true },
    });
    if (isPhoto) return f;

    const inConversation = await this.prisma.message.findFirst({
      where: {
        attachmentId: id,
        deletedAt: null,
        conversation: { members: { some: { userId, leftAt: null } } },
      },
      select: { id: true },
    });
    if (inConversation) return f;

    const inCollective = await this.prisma.sharedFile.findFirst({
      where: {
        fileId: id,
        deletedAt: null,
        collective: { memberships: { some: { userId, status: 'ACTIVE' } } },
      },
      select: { id: true },
    });
    if (inCollective) return f;

    throw new ForbiddenException('Not allowed');
  }

  /** Local storage: the file on disk. Null when files live in S3 (use signedUrl). */
  pathFor(f: FileObject): string | null {
    return this.s3 ? null : join(this.dir, f.storageKey);
  }

  /**
   * S3 storage: a CloudFront link valid until the end of the next hour. The same link is
   * handed out for the rest of this hour, so phones and browsers can cache the file.
   */
  signedUrl(f: FileObject): string | null {
    if (!this.s3) return null;
    const hour = 3_600_000;
    const until = new Date((Math.floor(Date.now() / hour) + 2) * hour);
    return getSignedUrl({
      url: `https://${this.s3.domain}/${f.storageKey.split('/').map(encodeURIComponent).join('/')}`,
      keyPairId: this.s3.keyPairId,
      privateKey: this.s3.privateKey,
      dateLessThan: until.toISOString(),
    });
  }
}

/** Cheap magic-number check so a renamed executable cannot pass as an image or PDF. */
function sniffMatches(mime: string, buf: Buffer): boolean {
  const h = buf.subarray(0, 12);
  switch (mime) {
    case 'image/jpeg':
      return h[0] === 0xff && h[1] === 0xd8;
    case 'image/png':
      return h.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/gif':
      return h.subarray(0, 3).toString() === 'GIF';
    case 'image/webp':
      return h.subarray(0, 4).toString() === 'RIFF' && h.subarray(8, 12).toString() === 'WEBP';
    case 'application/pdf':
      return h.subarray(0, 4).toString() === '%PDF';
    case 'application/msword':
    case 'application/vnd.ms-excel':
      return h[0] === 0xd0 && h[1] === 0xcf; // OLE compound file
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return h[0] === 0x50 && h[1] === 0x4b; // zip
    case 'text/plain':
      return !buf.subarray(0, 512).includes(0);
    default:
      return false;
  }
}

/** Images render inline; everything else downloads, under its original name. */
export function disposition(mime: string, name: string): string {
  return `${mime.startsWith('image/') ? 'inline' : 'attachment'}; filename="${encodeURIComponent(name)}"`;
}

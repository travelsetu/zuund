import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { FileDto } from '@zuund/shared';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import type { RequestUser } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { Env } from '../config/env';
import { FilesService, disposition } from './files.service';

@Controller('files')
@UseGuards(JwtAccessGuard)
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** multipart/form-data with a single `file` field. Returns the FileObject to reference elsewhere. */
  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  async upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<FileDto> {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > this.config.get('UPLOAD_MAX_BYTES', { infer: true }))
      throw new BadRequestException('File too large');
    return this.files.store(user.userId, file);
  }

  /**
   * A file the caller is allowed to see. Local storage streams it (images inline,
   * everything else downloads); S3 storage redirects to a short-lived signed CloudFront
   * link, which carries the same headers from the object.
   */
  @Get(':id')
  async read(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('size') size: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const f = await this.files.authorizeRead(id, user.userId);
    // ?size=thumb: the photo's small preview, or the original when it has none.
    const key = this.files.keyFor(f, size === 'thumb' ? 'thumb' : 'full');
    const thumb = key !== f.storageKey;
    const signed = this.files.signedUrl(key);
    if (signed) {
      // Only for this caller, briefly: the link itself is what may be cached.
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.redirect(302, signed);
      return;
    }
    const mime = thumb ? 'image/webp' : f.mimeType;
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', disposition(mime, f.fileName));
    res.sendFile(this.files.pathFor(key)!);
  }
}

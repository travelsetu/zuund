import {
  BadRequestException,
  Controller,
  Get,
  Param,
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
import { FilesService } from './files.service';

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

  /** Streams a file the caller is allowed to see. Images render inline; everything else downloads. */
  @Get(':id')
  async read(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const f = await this.files.authorizeRead(id, user.userId);
    const inline = f.mimeType.startsWith('image/');
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(f.fileName)}"`,
    );
    res.sendFile(this.files.pathFor(f));
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import { DomainException } from './domain.exception';

/**
 * Every error leaves the API as
 *   { success: false, error: { code, message, details? } }
 * Stack traces, Prisma messages and provider responses never reach a client;
 * they go to the log with the request path.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(err: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong';
    let details: unknown;

    if (err instanceof DomainException) {
      status = err.getStatus();
      code = err.code;
      message = err.message;
      details = err.details;
    } else if (err instanceof HttpException) {
      status = err.getStatus();
      const body = err.getResponse();
      const b = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
      code = (b.code as string | undefined) ?? CODE_BY_STATUS[status] ?? 'ERROR';
      // Nest's built-in pipes (ParseUUIDPipe etc.) report "Validation failed (…)"; same code as zod failures.
      if (
        status === HttpStatus.BAD_REQUEST &&
        String(b.message ?? err.message).startsWith('Validation failed')
      )
        code = 'VALIDATION_FAILED';
      const m = b.message ?? err.message;
      message = Array.isArray(m) ? String(m[0]) : String(m);
      details = b.details ?? (Array.isArray(m) && m.length > 1 ? m : undefined);
    } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002')
        [status, code, message] = [HttpStatus.CONFLICT, 'CONFLICT', 'This already exists'];
      else if (err.code === 'P2025')
        [status, code, message] = [HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found'];
      else if (err.code === 'P2003')
        [status, code, message] = [
          HttpStatus.CONFLICT,
          'CONFLICT',
          'Referenced record does not exist',
        ];
      else this.logger.error(`Prisma ${err.code} on ${req.method} ${req.url}: ${err.message}`);
    } else {
      this.logger.error(
        `Unhandled on ${req.method} ${req.url}: ${err instanceof Error ? err.stack : String(err)}`,
      );
    }

    if (
      status === HttpStatus.UNAUTHORIZED ||
      status === HttpStatus.FORBIDDEN ||
      status === HttpStatus.TOO_MANY_REQUESTS
    ) {
      // Security-relevant: worth a line, without the body.
      this.logger.warn(`${status} ${code} ${req.method} ${req.url} ip=${req.ip}`);
    }

    res.status(status).json({
      success: false,
      error: { code, message, ...(details !== undefined ? { details } : {}) },
    });
  }
}

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'UPSTREAM_ERROR',
};

import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { DomainException } from './domain.exception';

/** Validates a request body/query/params against a zod schema shared with the frontend. */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      throw new DomainException(
        'VALIDATION_FAILED',
        fields[0]
          ? `${fields[0].path ? fields[0].path + ': ' : ''}${fields[0].message}`
          : 'Invalid input',
        HttpStatus.BAD_REQUEST,
        fields,
      );
    }
    return result.data;
  }
}

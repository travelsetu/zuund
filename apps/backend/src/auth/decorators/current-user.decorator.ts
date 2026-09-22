import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../auth.constants';

/** Injects the user attached by JwtAccessGuard. Only valid on guarded routes. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!req.user) throw new Error('CurrentUser used on a route without JwtAccessGuard');
    return req.user;
  },
);

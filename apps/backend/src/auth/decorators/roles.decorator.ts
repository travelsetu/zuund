import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';
/** Restricts a route to the given roles. Must be combined with JwtAccessGuard (RolesGuard reads req.user). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

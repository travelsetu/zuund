import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import {
  updateProfileRequestSchema,
  type BuyerProfileDto,
  type MeDto,
  type UpdateProfileRequest,
} from '@zuund/shared';
import type { RequestUser } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAccessGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: RequestUser): Promise<MeDto> {
    return this.users.getMe(user.userId);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateProfileRequestSchema)) body: UpdateProfileRequest,
  ): Promise<MeDto> {
    return this.users.updateProfile(user.userId, body);
  }

  /** Another buyer's public profile: never email, phone or address. */
  @Get(':id')
  profile(
    @CurrentUser() viewer: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BuyerProfileDto> {
    return this.users.getPublicProfile(viewer.userId, id);
  }
}

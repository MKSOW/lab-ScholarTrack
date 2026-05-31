import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Decorates a controller or route with the allowed roles.
// Example: @Roles(Role.ADMIN) or @Roles(Role.ADMIN, Role.TEACHER)
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

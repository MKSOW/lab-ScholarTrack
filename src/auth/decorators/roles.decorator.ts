import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Décore un contrôleur ou une route avec les rôles autorisés.
// Exemple : @Roles(Role.ADMIN) ou @Roles(Role.ADMIN, Role.TEACHER)
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

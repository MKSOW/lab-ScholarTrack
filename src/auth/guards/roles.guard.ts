import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lit les rôles déclarés sur le handler ou la classe via @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Aucun @Roles() déclaré → la route ne nécessite pas de rôle spécifique
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // request.user est positionné par l'AuthGuard de @thallesp/nestjs-better-auth
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { role?: Role }; session?: unknown }>();
    this.logger.debug(`request.user = ${JSON.stringify(request.user)}`);
    this.logger.debug(`request.session = ${JSON.stringify(request.session)}`);
    const userRole = request.user?.role;

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Accès refusé : rôle requis ${requiredRoles.join(' ou ')}, rôle actuel ${userRole ?? 'inconnu'}`,
      );
    }

    return true;
  }
}

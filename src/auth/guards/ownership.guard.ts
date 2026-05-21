import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CHECK_OWNERSHIP_KEY } from '../decorators/check-ownership.decorator';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName = this.reflector.getAllAndOverride<string | undefined>(
      CHECK_OWNERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Pas de @CheckOwnership() sur la route → le guard laisse passer
    if (!paramName) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { id: string; role: Role };
      params: Record<string, string>;
    }>();

    const user = request.user;
    if (!user) return false;

    // Les admins ont accès à toutes les ressources
    if (user.role === Role.ADMIN) return true;

    // Seuls les teachers ont une logique d'appartenance sur les cours
    // Les étudiants : leur accès est restreint dans les services (filtre sur studentId)
    if (user.role !== Role.TEACHER) return true;

    const courseId = request.params[paramName];
    if (!courseId) return true;

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { teacherId: true },
    });

    if (!course) {
      throw new NotFoundException('Cours introuvable');
    }

    if (course.teacherId !== user.id) {
      throw new ForbiddenException(
        "Accès refusé : vous n'êtes pas le professeur de ce cours",
      );
    }

    return true;
  }
}

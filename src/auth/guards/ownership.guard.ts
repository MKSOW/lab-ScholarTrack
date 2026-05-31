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

    // No @CheckOwnership() on the route → the guard lets it through
    if (!paramName) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { id: string; role: Role };
      params: Record<string, string>;
    }>();

    const user = request.user;
    if (!user) return false;

    // Admins have access to every resource
    if (user.role === Role.ADMIN) return true;

    // Only teachers have course-ownership logic
    // Students: their access is restricted in the services (filtered on studentId)
    if (user.role !== Role.TEACHER) return true;

    const courseId = request.params[paramName];
    if (!courseId) return true;

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { teacherId: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.teacherId !== user.id) {
      throw new ForbiddenException(
        'Access denied: you are not the teacher of this course',
      );
    }

    return true;
  }
}

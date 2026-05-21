import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { OwnershipGuard } from './ownership.guard';
import { PrismaService } from '../../prisma/prisma.service';

function makeCtx(
  user: { id: string; role: Role } | null,
  params: Record<string, string> = {},
): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
  } as unknown as ExecutionContext;
}

describe('OwnershipGuard', () => {
  let guard: OwnershipGuard;
  let reflector: jest.Mocked<Reflector>;
  let prisma: jest.Mocked<Pick<PrismaService, 'course'>>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    prisma = {
      course: { findUnique: jest.fn() } as unknown as PrismaService['course'],
    };
    guard = new OwnershipGuard(reflector, prisma as unknown as PrismaService);
  });

  it('laisse passer si aucun @CheckOwnership sur la route', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const result = await guard.canActivate(
      makeCtx({ id: 'u1', role: Role.TEACHER }),
    );
    expect(result).toBe(true);
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
  });

  it('laisse passer un ADMIN sans verifier la DB', async () => {
    reflector.getAllAndOverride.mockReturnValue('id');
    const result = await guard.canActivate(
      makeCtx({ id: 'admin1', role: Role.ADMIN }, { id: 'course1' }),
    );
    expect(result).toBe(true);
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
  });

  it('laisse passer un STUDENT sans verifier la DB', async () => {
    reflector.getAllAndOverride.mockReturnValue('id');
    const result = await guard.canActivate(
      makeCtx({ id: 'student1', role: Role.STUDENT }, { id: 'course1' }),
    );
    expect(result).toBe(true);
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
  });

  it('laisse passer un TEACHER proprietaire du cours', async () => {
    reflector.getAllAndOverride.mockReturnValue('id');
    (prisma.course.findUnique as jest.Mock).mockResolvedValue({
      teacherId: 'teacher1',
    });
    const result = await guard.canActivate(
      makeCtx({ id: 'teacher1', role: Role.TEACHER }, { id: 'course1' }),
    );
    expect(result).toBe(true);
  });

  it('leve ForbiddenException si le TEACHER nest pas proprietaire', async () => {
    reflector.getAllAndOverride.mockReturnValue('id');
    (prisma.course.findUnique as jest.Mock).mockResolvedValue({
      teacherId: 'other-teacher',
    });
    await expect(
      guard.canActivate(
        makeCtx({ id: 'teacher1', role: Role.TEACHER }, { id: 'course1' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('leve NotFoundException si le cours nexiste pas', async () => {
    reflector.getAllAndOverride.mockReturnValue('id');
    (prisma.course.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      guard.canActivate(
        makeCtx({ id: 'teacher1', role: Role.TEACHER }, { id: 'unknown' }),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

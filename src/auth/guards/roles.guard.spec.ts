import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('allows access when no role is required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: Role.STUDENT } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when the role matches', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: Role.ADMIN } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when one of multiple roles matches', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN, Role.TEACHER]);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: Role.TEACHER } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when the role is insufficient', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: Role.STUDENT } }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no user in the request', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: null }) }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

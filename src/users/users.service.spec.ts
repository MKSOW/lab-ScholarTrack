import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

// Mock of the auth module: `../auth/auth` instantiates a real PrismaClient + Better Auth
// (ESM) at load time. We replace it with a controllable fake `auth.api.signUpEmail`.
jest.mock('../auth/auth', () => ({
  auth: {
    api: {
      signUpEmail: jest.fn(),
    },
  },
}));
// Grab the mocked reference to drive its return values in each test.
import { auth } from '../auth/auth';
const signUpEmail = auth.api.signUpEmail as jest.Mock;

// ─── Mock Prisma ───────────────────────────────────────────────────────────────

type PrismaMock = {
  user: { findUnique: jest.Mock; update: jest.Mock };
};

const makePrismaMock = (): PrismaMock => ({
  user: { findUnique: jest.fn(), update: jest.fn() },
});

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const DTO = {
  email: 'alice@example.com',
  name: 'Alice Martin',
  password: 'motdepasse123',
  role: 'STUDENT' as const,
};

const CREATED_USER = {
  id: 'user-1',
  email: DTO.email,
  name: DTO.name,
  role: Role.STUDENT,
  createdAt: new Date('2026-01-01'),
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaMock;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrismaMock();
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates the account via Better Auth then applies the admin-requested role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      signUpEmail.mockResolvedValue({ user: { id: 'user-1' } });
      prisma.user.update.mockResolvedValue(CREATED_USER);

      const result = await service.create(DTO);

      expect(result).toEqual(CREATED_USER);
      // Email uniqueness check before any Better Auth call
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: DTO.email },
      });
      expect(signUpEmail).toHaveBeenCalledWith({
        body: { email: DTO.email, name: DTO.name, password: DTO.password },
      });
      // The role is applied via update on the created user (id returned by Better Auth)
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { role: DTO.role },
        }),
      );
    });

    it('rejects with 409 when the email already exists, without calling Better Auth', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(DTO)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(signUpEmail).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects with 500 when Better Auth fails', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      signUpEmail.mockRejectedValue(new Error('better-auth down'));

      await expect(service.create(DTO)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});

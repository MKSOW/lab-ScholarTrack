import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

// Mock du module d'auth : `../auth/auth` instancie un vrai PrismaClient + Better Auth
// (ESM) au chargement. On le remplace par un faux `auth.api.signUpEmail` pilotable.
jest.mock('../auth/auth', () => ({
  auth: {
    api: {
      signUpEmail: jest.fn(),
    },
  },
}));
// On récupère la référence mockée pour piloter ses retours dans chaque test.
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
    it("crée le compte via Better Auth puis applique le rôle demandé par l'admin", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      signUpEmail.mockResolvedValue({ user: { id: 'user-1' } });
      prisma.user.update.mockResolvedValue(CREATED_USER);

      const result = await service.create(DTO);

      expect(result).toEqual(CREATED_USER);
      // Vérification d'unicité de l'email avant tout appel à Better Auth
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: DTO.email },
      });
      expect(signUpEmail).toHaveBeenCalledWith({
        body: { email: DTO.email, name: DTO.name, password: DTO.password },
      });
      // Le rôle est appliqué en update sur l'utilisateur créé (id renvoyé par Better Auth)
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { role: DTO.role },
        }),
      );
    });

    it("rejette avec 409 si l'email existe déjà, sans appeler Better Auth", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(DTO)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(signUpEmail).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejette avec 500 si Better Auth échoue', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      signUpEmail.mockRejectedValue(new Error('better-auth down'));

      await expect(service.create(DTO)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});

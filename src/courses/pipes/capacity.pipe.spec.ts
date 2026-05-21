import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CapacityPipe } from './capacity.pipe';

describe('CapacityPipe', () => {
  let pipe: CapacityPipe;
  let findUnique: jest.Mock;

  beforeEach(() => {
    findUnique = jest.fn();
    const prisma = {
      course: { findUnique },
    } as unknown as PrismaService;
    pipe = new CapacityPipe(prisma);
  });

  it('retourne le courseId quand le cours a de la place', async () => {
    findUnique.mockResolvedValue({
      capacity: 30,
      _count: { enrollments: 10 },
    });
    await expect(pipe.transform('course-1')).resolves.toBe('course-1');
  });

  it('accepte une inscription sur la derniere place disponible', async () => {
    findUnique.mockResolvedValue({
      capacity: 3,
      _count: { enrollments: 2 },
    });
    await expect(pipe.transform('course-1')).resolves.toBe('course-1');
  });

  it('leve NotFoundException quand le cours est introuvable', async () => {
    findUnique.mockResolvedValue(null);
    await expect(pipe.transform('inconnu')).rejects.toThrow(NotFoundException);
  });

  it('leve ConflictException quand le cours est complet', async () => {
    findUnique.mockResolvedValue({
      capacity: 3,
      _count: { enrollments: 3 },
    });
    await expect(pipe.transform('course-1')).rejects.toThrow(ConflictException);
  });

  it('leve ConflictException quand le nombre d inscrits depasse la capacite', async () => {
    findUnique.mockResolvedValue({
      capacity: 3,
      _count: { enrollments: 5 },
    });
    await expect(pipe.transform('course-1')).rejects.toThrow(ConflictException);
  });
});

import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';

const REQ = { user: { id: 'teacher-1', role: Role.TEACHER } };
const RESULT = { ok: true };

describe('GradesController', () => {
  let controller: GradesController;
  let service: {
    create: jest.Mock;
    findByCourse: jest.Mock;
    findByStudent: jest.Mock;
    importFromCsv: jest.Mock;
    getWeightedAverage: jest.Mock;
  };

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(RESULT),
      findByCourse: jest.fn().mockResolvedValue(RESULT),
      findByStudent: jest.fn().mockResolvedValue(RESULT),
      importFromCsv: jest.fn().mockResolvedValue(RESULT),
      getWeightedAverage: jest.fn().mockResolvedValue(RESULT),
    };
    controller = new GradesController(service as unknown as GradesService);
  });

  it('delegates create() with the request user', async () => {
    const dto = {
      courseId: 'c-1',
      studentId: 's-1',
      assessmentTypeId: 'at-1',
      value: 14,
    };
    await expect(controller.create(dto, REQ)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto, REQ.user);
  });

  it('delegates findByCourse()', async () => {
    await controller.findByCourse('c-1', REQ);
    expect(service.findByCourse).toHaveBeenCalledWith('c-1', REQ.user);
  });

  it('delegates findByStudent()', async () => {
    await controller.findByStudent('s-1', REQ);
    expect(service.findByStudent).toHaveBeenCalledWith('s-1', REQ.user);
  });

  it('delegates importFromCsv() when a file is provided', async () => {
    const file = { originalname: 'g.csv' } as Express.Multer.File;
    await controller.importFromCsv('c-1', file, REQ);
    expect(service.importFromCsv).toHaveBeenCalledWith('c-1', file, REQ.user);
  });

  it('rejects importFromCsv() with 400 when no file', () => {
    expect(() =>
      controller.importFromCsv(
        'c-1',
        undefined as unknown as Express.Multer.File,
        REQ,
      ),
    ).toThrow(BadRequestException);
    expect(service.importFromCsv).not.toHaveBeenCalled();
  });

  it('delegates getWeightedAverage()', async () => {
    await controller.getWeightedAverage('s-1', 'c-1', REQ);
    expect(service.getWeightedAverage).toHaveBeenCalledWith(
      's-1',
      'c-1',
      REQ.user,
    );
  });
});

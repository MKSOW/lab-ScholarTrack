import { Role } from '@prisma/client';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

const REQ = { user: { id: 'admin-1', role: Role.ADMIN } };
const RESULT = { ok: true };

describe('CoursesController', () => {
  let controller: CoursesController;
  let service: {
    create: jest.Mock;
    enroll: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(RESULT),
      enroll: jest.fn().mockResolvedValue(RESULT),
      findAll: jest.fn().mockResolvedValue(RESULT),
      findOne: jest.fn().mockResolvedValue(RESULT),
      update: jest.fn().mockResolvedValue(RESULT),
      remove: jest.fn().mockResolvedValue(RESULT),
    };
    controller = new CoursesController(service as unknown as CoursesService);
  });

  it('delegates create()', async () => {
    const dto = { code: 'M101', name: 'Math' } as never;
    await expect(controller.create(dto)).resolves.toBe(RESULT);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates enroll() passing the DTO studentId', async () => {
    await controller.enroll('c-1', { studentId: 's-1' });
    expect(service.enroll).toHaveBeenCalledWith('c-1', 's-1');
  });

  it('delegates findAll() with user then filter', async () => {
    const filter = { semester: '2026-S1' } as never;
    await controller.findAll(filter, REQ);
    expect(service.findAll).toHaveBeenCalledWith(REQ.user, filter);
  });

  it('delegates findOne()', async () => {
    await controller.findOne('c-1', REQ);
    expect(service.findOne).toHaveBeenCalledWith('c-1', REQ.user);
  });

  it('delegates update()', async () => {
    const dto = { name: 'New' } as never;
    await controller.update('c-1', dto);
    expect(service.update).toHaveBeenCalledWith('c-1', dto);
  });

  it('delegates remove()', async () => {
    await controller.remove('c-1');
    expect(service.remove).toHaveBeenCalledWith('c-1');
  });
});

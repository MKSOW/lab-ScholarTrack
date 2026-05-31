import { Role } from '@prisma/client';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

const REQ = { user: { id: 'teacher-1', role: Role.TEACHER } };
const RESULT = { ok: true };

describe('AttendanceController', () => {
  let controller: AttendanceController;
  let service: {
    createSession: jest.Mock;
    findSessionsByCourse: jest.Mock;
    recordAttendances: jest.Mock;
    cancelSession: jest.Mock;
    computeCourseAttendanceStats: jest.Mock;
    computeAttendanceStats: jest.Mock;
  };

  beforeEach(() => {
    service = {
      createSession: jest.fn().mockResolvedValue(RESULT),
      findSessionsByCourse: jest.fn().mockResolvedValue(RESULT),
      recordAttendances: jest.fn().mockResolvedValue(RESULT),
      cancelSession: jest.fn().mockResolvedValue(RESULT),
      computeCourseAttendanceStats: jest.fn().mockResolvedValue(RESULT),
      computeAttendanceStats: jest.fn().mockResolvedValue(RESULT),
    };
    controller = new AttendanceController(
      service as unknown as AttendanceService,
    );
  });

  it('délègue createSession() avec le user', async () => {
    const dto = { courseId: 'c-1', date: '2026-01-01' } as never;
    await expect(controller.createSession(dto, REQ)).resolves.toBe(RESULT);
    expect(service.createSession).toHaveBeenCalledWith(dto, REQ.user);
  });

  it('délègue findSessionsByCourse()', async () => {
    await controller.findSessionsByCourse('c-1', REQ);
    expect(service.findSessionsByCourse).toHaveBeenCalledWith('c-1', REQ.user);
  });

  it('délègue recordAttendances()', async () => {
    const dto = { records: [] } as never;
    await controller.recordAttendances('sess-1', dto, REQ);
    expect(service.recordAttendances).toHaveBeenCalledWith(
      'sess-1',
      dto,
      REQ.user,
    );
  });

  it('délègue cancelSession()', async () => {
    await controller.cancelSession('sess-1', REQ);
    expect(service.cancelSession).toHaveBeenCalledWith('sess-1', REQ.user);
  });

  it('délègue getCourseStats() en réordonnant (courseId, user, filter)', async () => {
    const filter = { atRisk: true } as never;
    await controller.getCourseStats('c-1', filter, REQ);
    expect(service.computeCourseAttendanceStats).toHaveBeenCalledWith(
      'c-1',
      REQ.user,
      filter,
    );
  });

  it('délègue getStudentStats() en réordonnant (studentId, courseId, user)', async () => {
    await controller.getStudentStats('c-1', 's-1', REQ);
    expect(service.computeAttendanceStats).toHaveBeenCalledWith(
      's-1',
      'c-1',
      REQ.user,
    );
  });
});

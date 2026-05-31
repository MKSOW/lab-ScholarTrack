import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  let controller: AdminController;
  let service: {
    importEnrollmentsFromCsv: jest.Mock;
    getSemesterStats: jest.Mock;
    exportSemesterCsv: jest.Mock;
  };

  beforeEach(() => {
    service = {
      importEnrollmentsFromCsv: jest.fn().mockResolvedValue({ imported: 3 }),
      getSemesterStats: jest.fn().mockResolvedValue({ courses: 2 }),
      exportSemesterCsv: jest.fn().mockResolvedValue('a,b,c\n1,2,3'),
    };
    controller = new AdminController(service as unknown as AdminService);
  });

  describe('importEnrollments', () => {
    it('delegates to the service when a file is provided', async () => {
      const file = { originalname: 'e.csv' } as Express.Multer.File;
      await expect(controller.importEnrollments(file)).resolves.toEqual({
        imported: 3,
      });
      expect(service.importEnrollmentsFromCsv).toHaveBeenCalledWith(file);
    });

    it('rejects with 400 when no file', () => {
      expect(() =>
        controller.importEnrollments(
          undefined as unknown as Express.Multer.File,
        ),
      ).toThrow(BadRequestException);
      expect(service.importEnrollmentsFromCsv).not.toHaveBeenCalled();
    });
  });

  it('delegates getSemesterStats()', async () => {
    await controller.getSemesterStats('2026-S1');
    expect(service.getSemesterStats).toHaveBeenCalledWith('2026-S1');
  });

  describe('exportSemesterCsv', () => {
    it('sets the download headers and sends the CSV', async () => {
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      await controller.exportSemesterCsv('2026-S1', res);

      expect(service.exportSemesterCsv).toHaveBeenCalledWith('2026-S1');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv; charset=utf-8',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="semester-2026-S1-results.csv"',
      );
      expect(res.send).toHaveBeenCalledWith('a,b,c\n1,2,3');
    });
  });
});

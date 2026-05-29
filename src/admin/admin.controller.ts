import { Controller, Get, Param, Res } from '@nestjs/common';
import {
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats/semester/:semester')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Aggregated semester statistics (admin reporting)',
    description:
      'Returns global KPIs for the requested semester: course count, unique student count, total enrollments, per-course averages and attendance rates, plus global at-risk count and attendance rate. Powered by Prisma aggregations to keep the work in the database.\n\nRBAC: ADMIN only.',
  })
  @ApiResponse({ status: 200, description: 'Aggregated statistics' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({
    status: 404,
    description: 'No course found for this semester',
  })
  getSemesterStats(@Param('semester') semester: string) {
    return this.adminService.getSemesterStats(semester);
  }

  @Get('export/semester/:semester')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'CSV export of semester results (admin)',
    description:
      'Downloads a CSV file with one row per enrolled student per course. Columns: studentId, studentName, studentEmail, courseCode, courseName, weightedAverage (0–20 or empty), isComplete, attendanceRate (0–1), atRisk.\n\nRBAC: ADMIN only.',
  })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'CSV file downloaded' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({
    status: 404,
    description: 'No course found for this semester',
  })
  async exportSemesterCsv(
    @Param('semester') semester: string,
    @Res() res: Response,
  ) {
    const csv = await this.adminService.exportSemesterCsv(semester);
    const filename = `semester-${semester}-results.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}

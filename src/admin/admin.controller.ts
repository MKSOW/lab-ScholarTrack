import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
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
}

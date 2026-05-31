import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AttendanceService } from './attendance.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { FilterStatsDto } from './dto/filter-stats.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';

type RequestUser = { id: string; role: Role };

@ApiTags('attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('sessions')
  @Roles(Role.TEACHER, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a session (course teacher or admin)',
  })
  @ApiResponse({ status: 201, description: 'Session created successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  createSession(
    @Body() dto: CreateSessionDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.attendanceService.createSession(dto, req.user);
  }

  @Get('sessions/course/:courseId')
  @ApiOperation({
    summary:
      "List a course's sessions — teacher (owner), student (enrolled) or admin",
  })
  @ApiResponse({ status: 200, description: 'List of sessions' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  findSessionsByCourse(
    @Param('courseId') courseId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.attendanceService.findSessionsByCourse(courseId, req.user);
  }

  @Post('sessions/:sessionId/record')
  @Roles(Role.TEACHER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Bulk-record a session's attendances — atomic all-or-nothing upsert",
  })
  @ApiResponse({ status: 200, description: 'Attendances recorded' })
  @ApiResponse({ status: 400, description: 'Session cancelled' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({
    status: 422,
    description: 'Errors detected — full report, no write performed',
  })
  recordAttendances(
    @Param('sessionId') sessionId: string,
    @Body() dto: RecordAttendanceDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.attendanceService.recordAttendances(sessionId, dto, req.user);
  }

  @Patch('sessions/:id/cancel')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Cancel a session (soft delete via cancelledAt)',
  })
  @ApiResponse({ status: 200, description: 'Session cancelled' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 409, description: 'Session already cancelled' })
  cancelSession(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.attendanceService.cancelSession(id, req.user);
  }

  @Get('stats/course/:courseId')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Class-wide attendance stats for a course (teacher view)',
    description:
      "Returns each enrolled student's attendance rate and atRisk flag, plus a top-level summary (totalStudents, atRiskCount). Optional ?atRisk=true filter to list only at-risk students.\n\nRBAC: TEACHER (own course only) or ADMIN.",
  })
  @ApiResponse({ status: 200, description: 'Class statistics' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  getCourseStats(
    @Param('courseId') courseId: string,
    @Query() filter: FilterStatsDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.attendanceService.computeCourseAttendanceStats(
      courseId,
      req.user,
      filter,
    );
  }

  @Get('stats/course/:courseId/student/:studentId')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Per-student attendance stats for a course (rate + atRisk flag)',
    description:
      'Returns the total number of non-cancelled sessions, the breakdown by status, the attendance rate (PRESENT + EXCUSED) and the atRisk flag triggered when the rate drops below the configured threshold.\n\nRBAC: STUDENT sees own stats only, TEACHER sees students of own courses only, ADMIN unrestricted.',
  })
  @ApiResponse({ status: 200, description: 'Statistics computed' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({
    status: 404,
    description: 'Course not found or student not enrolled',
  })
  getStudentStats(
    @Param('courseId') courseId: string,
    @Param('studentId') studentId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.attendanceService.computeAttendanceStats(
      studentId,
      courseId,
      req.user,
    );
  }
}

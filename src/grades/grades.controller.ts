import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateGradeDto } from './dto/create-grade.dto';
import { GradesService } from './grades.service';

type RequestUser = { id: string; role: Role };

@ApiTags('grades')
@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a grade (course teacher or admin)' })
  @ApiResponse({ status: 201, description: 'Grade recorded successfully' })
  @ApiResponse({
    status: 400,
    description: 'Student not enrolled in the course',
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({
    status: 404,
    description: 'Course, student or assessment type not found',
  })
  @ApiResponse({
    status: 409,
    description: 'A grade already exists for this assessment type',
  })
  create(@Body() dto: CreateGradeDto, @Req() req: { user: RequestUser }) {
    return this.gradesService.create(dto, req.user);
  }

  @Get('course/:courseId')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Grades of a course (owning teacher or admin)' })
  @ApiResponse({ status: 200, description: 'List of the course grades' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  findByCourse(
    @Param('courseId') courseId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.gradesService.findByCourse(courseId, req.user);
  }

  @Get('student/:studentId')
  @ApiOperation({
    summary:
      'Grades of a student — student: own grades; teacher: own courses only; admin: everything',
  })
  @ApiResponse({ status: 200, description: 'List of the student grades' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Student not found' })
  findByStudent(
    @Param('studentId') studentId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.gradesService.findByStudent(studentId, req.user);
  }

  @Post('import/:courseId')
  @Roles(Role.TEACHER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'CSV file — columns: studentId,assessmentTypeId,value,comment',
        },
      },
    },
  })
  @ApiOperation({
    summary:
      'CSV grade import — all-or-nothing: if any row is invalid, no grade is inserted',
  })
  @ApiResponse({
    status: 201,
    description: 'Import successful — { imported: N }',
  })
  @ApiResponse({
    status: 422,
    description:
      'Validation errors — full report provided, no insert performed',
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  importFromCsv(
    @Param('courseId') courseId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: RequestUser },
  ) {
    if (!file) throw new BadRequestException('No file received');
    return this.gradesService.importFromCsv(courseId, file, req.user);
  }

  @Get('average/:studentId/:courseId')
  @ApiOperation({
    summary:
      'Weighted average — Σ(grade × weight / 100). If grades are missing, returns a normalized provisional average + isComplete: false',
  })
  @ApiResponse({ status: 200, description: 'Weighted average computed' })
  @ApiResponse({
    status: 400,
    description: 'Student not enrolled in the course',
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Course or student not found' })
  getWeightedAverage(
    @Param('studentId') studentId: string,
    @Param('courseId') courseId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.gradesService.getWeightedAverage(studentId, courseId, req.user);
  }
}

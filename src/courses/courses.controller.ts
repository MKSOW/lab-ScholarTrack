import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CheckOwnership } from '../auth/decorators/check-ownership.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { CoursesService } from './courses.service';
import { CapacityPipe } from './pipes/capacity.pipe';
import { CreateCourseDto } from './dto/create-course.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { FilterCoursesDto } from './dto/filter-courses.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

type RequestUser = { id: string; role: Role };

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a course (admin only)' })
  @ApiResponse({ status: 201, description: 'Course created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or weights do not sum to 100',
  })
  @ApiResponse({ status: 409, description: 'Course code already in use' })
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Post(':id/enroll')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Enroll a student in a course (admin only)',
  })
  @ApiResponse({ status: 201, description: 'Student enrolled successfully' })
  @ApiResponse({ status: 404, description: 'Course or student not found' })
  @ApiResponse({
    status: 409,
    description: 'Course full or student already enrolled',
  })
  enroll(
    // CapacityPipe checks course capacity before reaching the service
    @Param('id', CapacityPipe) courseId: string,
    @Body() dto: EnrollStudentDto,
  ) {
    return this.coursesService.enroll(courseId, dto.studentId);
  }

  @Get()
  @ApiOperation({
    summary: 'List courses — filtering (semester, teacher) and pagination',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of courses' })
  findAll(
    @Query() filter: FilterCoursesDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.coursesService.findAll(req.user, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a course detail' })
  @ApiResponse({ status: 200, description: 'Course detail' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  findOne(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.coursesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TEACHER)
  @CheckOwnership('id')
  @UseGuards(OwnershipGuard)
  @ApiOperation({
    summary: 'Update a course (admin or owning teacher)',
  })
  @ApiResponse({ status: 200, description: 'Course updated' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a course (admin only)' })
  @ApiResponse({ status: 200, description: 'Course deleted' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }
}

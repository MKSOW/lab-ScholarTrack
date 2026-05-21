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
  @ApiOperation({ summary: 'Créer un cours (admin uniquement)' })
  @ApiResponse({ status: 201, description: 'Cours créé avec succès' })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou somme des poids ≠ 100',
  })
  @ApiResponse({ status: 409, description: 'Code cours déjà utilisé' })
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Post(':id/enroll')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Inscrire un étudiant à un cours (admin uniquement)',
  })
  @ApiResponse({ status: 201, description: 'Étudiant inscrit avec succès' })
  @ApiResponse({ status: 404, description: 'Cours ou étudiant introuvable' })
  @ApiResponse({
    status: 409,
    description: 'Cours complet ou étudiant déjà inscrit',
  })
  enroll(
    // CapacityPipe vérifie la capacité du cours avant d'atteindre le service
    @Param('id', CapacityPipe) courseId: string,
    @Body() dto: EnrollStudentDto,
  ) {
    return this.coursesService.enroll(courseId, dto.studentId);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les cours — filtrage (semestre, enseignant) et pagination',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des cours' })
  findAll(
    @Query() filter: FilterCoursesDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.coursesService.findAll(req.user, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: "Obtenir le détail d'un cours" })
  @ApiResponse({ status: 200, description: 'Détail du cours' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Cours introuvable' })
  findOne(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.coursesService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TEACHER)
  @CheckOwnership('id')
  @UseGuards(OwnershipGuard)
  @ApiOperation({
    summary: 'Mettre à jour un cours (admin ou professeur propriétaire)',
  })
  @ApiResponse({ status: 200, description: 'Cours mis à jour' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Cours introuvable' })
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer un cours (admin uniquement)' })
  @ApiResponse({ status: 200, description: 'Cours supprimé' })
  @ApiResponse({ status: 404, description: 'Cours introuvable' })
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }
}

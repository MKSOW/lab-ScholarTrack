import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
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
  @ApiOperation({ summary: 'Saisir une note (teacher du cours ou admin)' })
  @ApiResponse({ status: 201, description: 'Note saisie avec succès' })
  @ApiResponse({ status: 400, description: 'Étudiant non inscrit au cours' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({
    status: 404,
    description: 'Cours, étudiant ou type évaluation introuvable',
  })
  @ApiResponse({
    status: 409,
    description: "Note déjà saisie pour ce type d'évaluation",
  })
  create(@Body() dto: CreateGradeDto, @Req() req: { user: RequestUser }) {
    return this.gradesService.create(dto, req.user);
  }

  @Get('course/:courseId')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: "Notes d'un cours (teacher propriétaire ou admin)" })
  @ApiResponse({ status: 200, description: 'Liste des notes du cours' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Cours introuvable' })
  findByCourse(
    @Param('courseId') courseId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.gradesService.findByCourse(courseId, req.user);
  }

  @Get('student/:studentId')
  @ApiOperation({
    summary:
      "Notes d'un étudiant — student : ses propres notes ; teacher : ses cours uniquement ; admin : tout",
  })
  @ApiResponse({ status: 200, description: "Liste des notes de l'étudiant" })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Étudiant introuvable' })
  findByStudent(
    @Param('studentId') studentId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.gradesService.findByStudent(studentId, req.user);
  }

  @Get('average/:studentId/:courseId')
  @ApiOperation({
    summary:
      'Moyenne pondérée — Σ(note × poids / 100). Si des notes manquent, retourne une moyenne provisoire normalisée + isComplete: false',
  })
  @ApiResponse({ status: 200, description: 'Moyenne pondérée calculée' })
  @ApiResponse({ status: 400, description: 'Étudiant non inscrit au cours' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Cours ou étudiant introuvable' })
  getWeightedAverage(
    @Param('studentId') studentId: string,
    @Param('courseId') courseId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.gradesService.getWeightedAverage(studentId, courseId, req.user);
  }
}

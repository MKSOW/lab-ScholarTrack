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
            'Fichier CSV — colonnes : studentId,assessmentTypeId,value,comment',
        },
      },
    },
  })
  @ApiOperation({
    summary:
      "Import CSV de notes — tout-ou-rien : si une ligne est invalide, aucune note n'est insérée",
  })
  @ApiResponse({ status: 201, description: 'Import réussi — { imported: N }' })
  @ApiResponse({
    status: 422,
    description:
      'Erreurs de validation — rapport complet fourni, aucune insertion effectuée',
  })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Cours introuvable' })
  importFromCsv(
    @Param('courseId') courseId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: RequestUser },
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu');
    return this.gradesService.importFromCsv(courseId, file, req.user);
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

import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
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

  @Post('import/enrollments')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Fichier CSV — colonnes : studentId,courseId',
        },
      },
    },
  })
  @ApiOperation({
    summary: "Import CSV d'inscriptions en masse (admin)",
    description:
      "Tout-ou-rien : toutes les lignes sont validées (étudiant existant, cours existant, pas de doublon, capacité disponible) avant toute insertion. Si une ligne est invalide, l'import entier est annulé avec un rapport d'erreurs complet.\n\nRBAC: ADMIN uniquement.",
  })
  @ApiResponse({
    status: 201,
    description: 'Import réussi — { imported, summary }',
  })
  @ApiResponse({
    status: 422,
    description:
      'Erreurs de validation — rapport complet, aucune insertion effectuée',
  })
  @ApiResponse({
    status: 400,
    description: 'Fichier manquant ou CSV mal formé',
  })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  importEnrollments(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu');
    return this.adminService.importEnrollmentsFromCsv(file);
  }

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

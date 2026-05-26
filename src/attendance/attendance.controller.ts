import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AttendanceService } from './attendance.service';
import { CreateSessionDto } from './dto/create-session.dto';

type RequestUser = { id: string; role: Role };

@ApiTags('attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('sessions')
  @Roles(Role.TEACHER, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer une séance (teacher du cours ou admin)',
  })
  @ApiResponse({ status: 201, description: 'Séance créée avec succès' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Cours introuvable' })
  createSession(
    @Body() dto: CreateSessionDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.attendanceService.createSession(dto, req.user);
  }

  @Get('sessions/course/:courseId')
  @ApiOperation({
    summary:
      "Lister les séances d'un cours — teacher (propriétaire), student (inscrit) ou admin",
  })
  @ApiResponse({ status: 200, description: 'Liste des séances' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Cours introuvable' })
  findSessionsByCourse(
    @Param('courseId') courseId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.attendanceService.findSessionsByCourse(courseId, req.user);
  }

  @Patch('sessions/:id/cancel')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Annuler une séance (soft delete via cancelledAt)',
  })
  @ApiResponse({ status: 200, description: 'Séance annulée' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Séance introuvable' })
  @ApiResponse({ status: 409, description: 'Séance déjà annulée' })
  cancelSession(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.attendanceService.cancelSession(id, req.user);
  }
}

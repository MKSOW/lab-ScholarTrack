import { Module } from '@nestjs/common';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  controllers: [CoursesController],
  // OwnershipGuard est fourni ici pour que @UseGuards(OwnershipGuard) puisse
  // résoudre ses dépendances (Reflector + PrismaService) via le système DI.
  providers: [CoursesService, OwnershipGuard],
})
export class CoursesModule {}

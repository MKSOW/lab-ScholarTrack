import { Module } from '@nestjs/common';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CapacityPipe } from './pipes/capacity.pipe';

@Module({
  controllers: [CoursesController],
  // OwnershipGuard et CapacityPipe sont fournis ici pour que NestJS puisse
  // résoudre leurs dépendances (Reflector, PrismaService) via le système DI.
  providers: [CoursesService, OwnershipGuard, CapacityPipe],
})
export class CoursesModule {}

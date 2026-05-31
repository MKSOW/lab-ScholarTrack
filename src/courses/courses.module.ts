import { Module } from '@nestjs/common';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CapacityPipe } from './pipes/capacity.pipe';

@Module({
  controllers: [CoursesController],
  // OwnershipGuard and CapacityPipe are provided here so NestJS can resolve
  // their dependencies (Reflector, PrismaService) through the DI system.
  providers: [CoursesService, OwnershipGuard, CapacityPipe],
})
export class CoursesModule {}

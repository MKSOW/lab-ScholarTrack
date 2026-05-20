import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Module Prisma marqué @Global() pour exposer PrismaService
 * dans toute l'application sans avoir à le ré-importer dans chaque module métier.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
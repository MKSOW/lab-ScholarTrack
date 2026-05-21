import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { auth } from './auth/auth';

@Module({
  imports: [
    PrismaModule,
    // Enregistre Better Auth dans NestJS et monte un AuthGuard global.
    // Toutes les routes sont protégées par défaut — utiliser @AllowAnonymous()
    // pour les routes publiques.
    AuthModule.forRoot({ auth }),
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

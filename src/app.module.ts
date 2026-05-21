import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { RolesGuard } from './auth/guards/roles.guard';
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
  providers: [
    AppService,
    // Enregistre RolesGuard globalement — s'exécute après AuthGuard pour toutes les routes
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Rate limiting appliqué à toutes les routes : 100 req / 15 min par IP
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}

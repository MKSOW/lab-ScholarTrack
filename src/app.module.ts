import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard, AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { GradesModule } from './grades/grades.module';
import { RolesGuard } from './auth/guards/roles.guard';
import { auth } from './auth/auth';

@Module({
  imports: [
    PrismaModule,
    // disableGlobalAuthGuard: true → on désactive le guard interne de la librairie
    // pour le re-enregistrer explicitement ci-dessous et garantir l'ordre d'exécution.
    AuthModule.forRoot({ auth, disableGlobalAuthGuard: true }),
    UsersModule,
    CoursesModule,
    GradesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Ordre garanti : AuthGuard en premier (peuple request.user), puis RolesGuard (vérifie le rôle).
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // On instancie RateLimitMiddleware nous-mêmes (constructeur à params primitifs,
    // non injectables par DI), puis on l'applique comme middleware fonctionnel.
    // .bind() préserve `this` pour que le Map interne reste partagé entre requêtes.
    const rateLimiter = new RateLimitMiddleware();
    consumer.apply(rateLimiter.use.bind(rateLimiter)).forRoutes('*');
  }
}

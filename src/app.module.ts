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
import { AttendanceModule } from './attendance/attendance.module';
import { AdminModule } from './admin/admin.module';
import { RolesGuard } from './auth/guards/roles.guard';
import { auth } from './auth/auth';

@Module({
  imports: [
    PrismaModule,
    // disableGlobalAuthGuard: true → disable the library's internal guard
    // so we can re-register it explicitly below and guarantee execution order.
    AuthModule.forRoot({ auth, disableGlobalAuthGuard: true }),
    UsersModule,
    CoursesModule,
    GradesModule,
    AttendanceModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guaranteed order: AuthGuard first (populates request.user), then RolesGuard (checks the role).
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // We instantiate RateLimitMiddleware ourselves (constructor with primitive
    // params, not DI-injectable), then apply it as a functional middleware.
    // .bind() preserves `this` so the internal Map stays shared across requests.
    const rateLimiter = new RateLimitMiddleware();
    consumer.apply(rateLimiter.use.bind(rateLimiter)).forRoutes('*');
  }
}

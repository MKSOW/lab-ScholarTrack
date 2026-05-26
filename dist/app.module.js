"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const nestjs_better_auth_1 = require("@thallesp/nestjs-better-auth");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const rate_limit_middleware_1 = require("./common/middleware/rate-limit.middleware");
const prisma_module_1 = require("./prisma/prisma.module");
const users_module_1 = require("./users/users.module");
const courses_module_1 = require("./courses/courses.module");
const grades_module_1 = require("./grades/grades.module");
const roles_guard_1 = require("./auth/guards/roles.guard");
const auth_1 = require("./auth/auth");
let AppModule = class AppModule {
    configure(consumer) {
        const rateLimiter = new rate_limit_middleware_1.RateLimitMiddleware();
        consumer.apply(rateLimiter.use.bind(rateLimiter)).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            nestjs_better_auth_1.AuthModule.forRoot({ auth: auth_1.auth, disableGlobalAuthGuard: true }),
            users_module_1.UsersModule,
            courses_module_1.CoursesModule,
            grades_module_1.GradesModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            { provide: core_1.APP_GUARD, useClass: nestjs_better_auth_1.AuthGuard },
            { provide: core_1.APP_GUARD, useClass: roles_guard_1.RolesGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoursesModule = void 0;
const common_1 = require("@nestjs/common");
const ownership_guard_1 = require("../auth/guards/ownership.guard");
const courses_controller_1 = require("./courses.controller");
const courses_service_1 = require("./courses.service");
const capacity_pipe_1 = require("./pipes/capacity.pipe");
let CoursesModule = class CoursesModule {
};
exports.CoursesModule = CoursesModule;
exports.CoursesModule = CoursesModule = __decorate([
    (0, common_1.Module)({
        controllers: [courses_controller_1.CoursesController],
        providers: [courses_service_1.CoursesService, ownership_guard_1.OwnershipGuard, capacity_pipe_1.CapacityPipe],
    })
], CoursesModule);
//# sourceMappingURL=courses.module.js.map
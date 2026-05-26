import { Role } from '@prisma/client';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { FilterCoursesDto } from './dto/filter-courses.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
type RequestUser = {
    id: string;
    role: Role;
};
export declare class CoursesController {
    private readonly coursesService;
    constructor(coursesService: CoursesService);
    create(dto: CreateCourseDto): Promise<{
        teacher: {
            email: string;
            id: string;
            name: string;
        };
        assessmentTypes: {
            id: string;
            name: string;
            weight: import("@prisma/client/runtime/library").Decimal;
            courseId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        code: string;
        capacity: number;
        semester: string;
        teacherId: string;
    }>;
    enroll(courseId: string, dto: EnrollStudentDto): Promise<{
        course: {
            id: string;
            name: string;
            code: string;
        };
        student: {
            email: string;
            id: string;
            name: string;
        };
    } & {
        id: string;
        studentId: string;
        courseId: string;
        enrolledAt: Date;
    }>;
    findAll(filter: FilterCoursesDto, req: {
        user: RequestUser;
    }): Promise<{
        data: ({
            _count: {
                enrollments: number;
            };
            teacher: {
                email: string;
                id: string;
                name: string;
            };
            assessmentTypes: {
                id: string;
                name: string;
                weight: import("@prisma/client/runtime/library").Decimal;
                courseId: string;
            }[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            description: string | null;
            code: string;
            capacity: number;
            semester: string;
            teacherId: string;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findOne(id: string, req: {
        user: RequestUser;
    }): Promise<{
        _count: {
            enrollments: number;
        };
        teacher: {
            email: string;
            id: string;
            name: string;
        };
        assessmentTypes: {
            id: string;
            name: string;
            weight: import("@prisma/client/runtime/library").Decimal;
            courseId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        code: string;
        capacity: number;
        semester: string;
        teacherId: string;
    }>;
    update(id: string, dto: UpdateCourseDto): Promise<{
        assessmentTypes: {
            id: string;
            name: string;
            weight: import("@prisma/client/runtime/library").Decimal;
            courseId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        code: string;
        capacity: number;
        semester: string;
        teacherId: string;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
export {};

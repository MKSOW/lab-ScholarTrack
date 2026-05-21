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
        assessmentTypes: {
            name: string;
            weight: import("@prisma/client/runtime/library").Decimal;
            id: string;
            courseId: string;
        }[];
        teacher: {
            name: string;
            id: string;
            email: string;
        };
    } & {
        description: string | null;
        name: string;
        code: string;
        capacity: number;
        semester: string;
        teacherId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    enroll(courseId: string, dto: EnrollStudentDto): Promise<{
        course: {
            name: string;
            code: string;
            id: string;
        };
        student: {
            name: string;
            id: string;
            email: string;
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
            assessmentTypes: {
                name: string;
                weight: import("@prisma/client/runtime/library").Decimal;
                id: string;
                courseId: string;
            }[];
            teacher: {
                name: string;
                id: string;
                email: string;
            };
            _count: {
                enrollments: number;
            };
        } & {
            description: string | null;
            name: string;
            code: string;
            capacity: number;
            semester: string;
            teacherId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
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
        assessmentTypes: {
            name: string;
            weight: import("@prisma/client/runtime/library").Decimal;
            id: string;
            courseId: string;
        }[];
        teacher: {
            name: string;
            id: string;
            email: string;
        };
        _count: {
            enrollments: number;
        };
    } & {
        description: string | null;
        name: string;
        code: string;
        capacity: number;
        semester: string;
        teacherId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, dto: UpdateCourseDto): Promise<{
        assessmentTypes: {
            name: string;
            weight: import("@prisma/client/runtime/library").Decimal;
            id: string;
            courseId: string;
        }[];
    } & {
        description: string | null;
        name: string;
        code: string;
        capacity: number;
        semester: string;
        teacherId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
export {};

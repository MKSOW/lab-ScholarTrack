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
            name: string;
            id: string;
            email: string;
        };
        assessmentTypes: {
            name: string;
            id: string;
            weight: import("@prisma/client/runtime/library").Decimal;
            courseId: string;
        }[];
    } & {
        name: string;
        id: string;
        code: string;
        description: string | null;
        capacity: number;
        semester: string;
        createdAt: Date;
        updatedAt: Date;
        teacherId: string;
    }>;
    enroll(courseId: string, dto: EnrollStudentDto): Promise<{
        course: {
            name: string;
            id: string;
            code: string;
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
            teacher: {
                name: string;
                id: string;
                email: string;
            };
            assessmentTypes: {
                name: string;
                id: string;
                weight: import("@prisma/client/runtime/library").Decimal;
                courseId: string;
            }[];
            _count: {
                enrollments: number;
            };
        } & {
            name: string;
            id: string;
            code: string;
            description: string | null;
            capacity: number;
            semester: string;
            createdAt: Date;
            updatedAt: Date;
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
        teacher: {
            name: string;
            id: string;
            email: string;
        };
        assessmentTypes: {
            name: string;
            id: string;
            weight: import("@prisma/client/runtime/library").Decimal;
            courseId: string;
        }[];
        _count: {
            enrollments: number;
        };
    } & {
        name: string;
        id: string;
        code: string;
        description: string | null;
        capacity: number;
        semester: string;
        createdAt: Date;
        updatedAt: Date;
        teacherId: string;
    }>;
    update(id: string, dto: UpdateCourseDto): Promise<{
        assessmentTypes: {
            name: string;
            id: string;
            weight: import("@prisma/client/runtime/library").Decimal;
            courseId: string;
        }[];
    } & {
        name: string;
        id: string;
        code: string;
        description: string | null;
        capacity: number;
        semester: string;
        createdAt: Date;
        updatedAt: Date;
        teacherId: string;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
export {};

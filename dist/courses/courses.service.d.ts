import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
export type CourseUser = {
    id: string;
    role: Role;
};
export declare class CoursesService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
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
    findAll(user: CourseUser): Promise<({
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
    })[] | ({
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
    })[]>;
    findOne(id: string, user: CourseUser): Promise<{
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
    enroll(courseId: string, studentId: string): Promise<{
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
}

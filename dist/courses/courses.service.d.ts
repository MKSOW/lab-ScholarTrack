import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { FilterCoursesDto } from './dto/filter-courses.dto';
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
            email: string;
            id: string;
            name: string;
        };
        assessmentTypes: {
            id: string;
            name: string;
            weight: Prisma.Decimal;
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
    findAll(user: CourseUser, filter: FilterCoursesDto): Promise<{
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
                weight: Prisma.Decimal;
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
    findOne(id: string, user: CourseUser): Promise<{
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
            weight: Prisma.Decimal;
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
            weight: Prisma.Decimal;
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
    enroll(courseId: string, studentId: string): Promise<{
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
}

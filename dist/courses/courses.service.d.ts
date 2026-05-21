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
        assessmentTypes: {
            name: string;
            weight: Prisma.Decimal;
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
    findAll(user: CourseUser, filter: FilterCoursesDto): Promise<{
        data: ({
            assessmentTypes: {
                name: string;
                weight: Prisma.Decimal;
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
    findOne(id: string, user: CourseUser): Promise<{
        assessmentTypes: {
            name: string;
            weight: Prisma.Decimal;
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
            weight: Prisma.Decimal;
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
    enroll(courseId: string, studentId: string): Promise<{
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
}

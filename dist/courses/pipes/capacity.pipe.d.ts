import { PipeTransform } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
export declare class CapacityPipe implements PipeTransform<string, Promise<string>> {
    private readonly prisma;
    constructor(prisma: PrismaService);
    transform(courseId: string): Promise<string>;
}

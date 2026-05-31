import {
  ConflictException,
  Injectable,
  NotFoundException,
  PipeTransform,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Course capacity-check pipe.
 * Bound to the `:id` param of the `POST /courses/:id/enroll` route.
 * Receives the course id, verifies that seats remain, and returns the id
 * unchanged when enrollment is possible.
 */
@Injectable()
export class CapacityPipe implements PipeTransform<string, Promise<string>> {
  constructor(private readonly prisma: PrismaService) {}

  async transform(courseId: string): Promise<string> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        capacity: true,
        _count: { select: { enrollments: true } },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course._count.enrollments >= course.capacity) {
      throw new ConflictException(
        `Course full: maximum capacity of ${course.capacity} student(s) reached`,
      );
    }

    return courseId;
  }
}

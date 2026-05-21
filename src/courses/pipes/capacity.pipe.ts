import {
  ConflictException,
  Injectable,
  NotFoundException,
  PipeTransform,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Pipe de vérification de capacité.
// Branché sur le paramètre :id de la route POST /courses/:id/enroll.
// Reçoit l'identifiant du cours, vérifie qu'il reste de la place,
// et renvoie l'id inchangé si l'inscription est possible.
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
      throw new NotFoundException('Cours introuvable');
    }

    if (course._count.enrollments >= course.capacity) {
      throw new ConflictException(
        `Cours complet : capacité maximale de ${course.capacity} étudiant(s) atteinte`,
      );
    }

    return courseId;
  }
}

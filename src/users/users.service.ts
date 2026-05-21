import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { auth } from '../auth/auth';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    // Vérification préalable pour retourner une erreur claire avant d'appeler Better Auth
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        `Un compte avec l'email "${dto.email}" existe déjà`,
      );
    }

    // Création du compte via Better Auth : gère le hash du mot de passe
    // et insère les enregistrements User + Account en base
    let createdUserId: string;
    try {
      const response = await auth.api.signUpEmail({
        body: {
          email: dto.email,
          name: dto.name,
          password: dto.password,
        },
      });
      createdUserId = response.user.id;
    } catch {
      throw new InternalServerErrorException(
        'Échec de la création du compte via Better Auth',
      );
    }

    // Better Auth crée l'utilisateur avec role=STUDENT par défaut (additionalFields).
    // On met à jour le rôle souhaité par l'admin immédiatement après.
    const user = await this.prisma.user.update({
      where: { id: createdUserId },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    this.logger.log(`Compte créé : ${user.email} (rôle: ${user.role})`);
    return user;
  }
}

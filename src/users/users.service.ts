import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { auth } from '../auth/auth';
import { CreateUserDto } from './dto/create-user.dto';

/**
 * Handles creation of STUDENT/TEACHER accounts (admin-only).
 * Delegates password hashing and User/Account persistence to Better Auth,
 * then applies the role requested by the admin.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new account and assigns the requested role.
   * @throws ConflictException if the email is already taken.
   * @throws InternalServerErrorException if Better Auth fails.
   */
  async create(dto: CreateUserDto) {
    // Pre-check to return a clear error before calling Better Auth
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        `An account with email "${dto.email}" already exists`,
      );
    }

    // Account creation via Better Auth: handles password hashing
    // and inserts the User + Account records in the database
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
        'Failed to create the account via Better Auth',
      );
    }

    // Better Auth creates the user with role=STUDENT by default (additionalFields).
    // We immediately update it to the role requested by the admin.
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

    this.logger.log(`Account created: ${user.email} (role: ${user.role})`);
    return user;
  }
}

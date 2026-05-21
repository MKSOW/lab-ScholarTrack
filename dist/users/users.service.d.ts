import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersService {
  private readonly prisma;
  private readonly logger;
  constructor(prisma: PrismaService);
  create(dto: CreateUserDto): Promise<{
    id: string;
    email: string;
    name: string;
    createdAt: Date;
    role: import('@prisma/client').$Enums.Role;
  }>;
}

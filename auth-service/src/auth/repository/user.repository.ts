import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

type CreateUserInput = {
  email: string;
  username: string;
  passwordHash: string;
};

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}
  
  async createUser(data: CreateUserInput, defaultRoleName = 'user') {
    const role = await this.prisma.role.findUnique({
      where: { name: defaultRoleName },
    });

    if (!role) {
      throw new Error(`Default role '${defaultRoleName}' not found`);
    }

    return this.prisma.user.create({
      data: {
        ...data,
        roleId: role.id,
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
      },
    });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        role: true,
      },
    });
  }
}
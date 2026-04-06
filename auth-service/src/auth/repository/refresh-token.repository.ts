import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    return this.prisma.refreshToken.create({
      data,
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.refreshToken.findMany({
      where: {
        userId,
        revoked: false,
      },
    });
  }

  async findActiveByUserId(userId: string) {
    return this.prisma.refreshToken.findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async revokeExpiredByUser(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revoked: false,
        expiresAt: {
          lte: new Date(),
        },
      },
      data: { revoked: true },
    });
  }

  async revoke(id: string) {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revoked: true },
    });
  }

  async revokeMany(ids: string[]) {
    if (ids.length === 0) {
      return { count: 0 };
    }

    return this.prisma.refreshToken.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: { revoked: true },
    });
  }

  async revokeAllByUser(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }
}

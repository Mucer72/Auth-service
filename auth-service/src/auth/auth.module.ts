import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UserRepository } from './repository/user.repository';
import { RoleRepository } from './repository/role.repository';
import { RefreshTokenRepository } from './repository/refresh-token.repository';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthGrpcController } from './auth.grpc.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.SECRET_KEY,
    }),
    PrismaModule,
  ],
  providers: [
    AuthService,
    UserRepository,
    RoleRepository,
    RefreshTokenRepository,
    JwtStrategy,
  ],
  controllers: [
    AuthController,
    AuthGrpcController
  ],
  exports: [AuthService],
})
export class AuthModule {}
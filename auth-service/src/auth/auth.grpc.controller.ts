import { Controller, Req, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import type {
  LoginRequest,
  LogoutResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshRequest,
  LogoutRequest,
  TokenPair,
  User,
} from './generated/auth';
import { GrpcErrorInterceptor } from './common/grpc-error.interceptor';
import { Timestamp } from './generated/google/protobuf/timestamp';

@Controller()
@UseInterceptors(GrpcErrorInterceptor)
export class AuthGrpcController {
  constructor(private authService: AuthService) {}

  @GrpcMethod('AuthService', 'Login')
  async login(data: LoginRequest): Promise<TokenPair> {
    const tokens = await this.authService.login(data.identifier, data.password);

    return this.toTokenPair(tokens);
  }

  @GrpcMethod('AuthService', 'Register')
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const user = await this.authService.register(
      data.email,
      data.username,
      data.password,
    );

    return {
      user: this.toGrpcUser(user),
    };
  }

  @GrpcMethod('AuthService', 'Refresh')
  async refresh(data: RefreshRequest): Promise<TokenPair> {
    const tokens = await this.authService.refresh(
      data.refreshToken,
      data.userId,
    );

    return this.toTokenPair(tokens);
  }

  @GrpcMethod('AuthService', 'Logout')
  async logout(data: LogoutRequest): Promise<LogoutResponse> {
    const message = await this.authService.logout(
      data.refreshToken,
      data.userId,
    );

    return { message };
  }

  @GrpcMethod('AuthService', 'VerifyToken')
  async verifyToken(data: { token: string }) {
    return this.authService.verifyToken(data.token);
  }

  private toTokenPair(tokens: {
    access_token: string;
    refresh_token: string;
  }): TokenPair {
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
  }

  private toGrpcUser(user: {
    id: string;
    email: string;
    username: string | null;
    roleId: string;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return {
      id: user.id,
      email: user.email,
      username: user.username ?? '',
      roleId: user.roleId,
      createdAt: this.toTimestamp(user.createdAt),
      updatedAt: this.toTimestamp(user.updatedAt),
    };
  }

  private toTimestamp(value: Date): Timestamp {
    const date = value instanceof Date ? value : new Date(value);

    return {
      seconds: Math.floor(date.getTime() / 1000),
      nanos: date.getMilliseconds() * 1_000_000,
    };
  }
}

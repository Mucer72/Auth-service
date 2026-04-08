import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import type { LoginRequest, RegisterRequest, RefreshRequest, LogoutRequest } from './generated/auth';

@Controller()
export class AuthGrpcController {
  constructor(private authService: AuthService) {}

  @GrpcMethod('AuthService', 'Login')
  async login(data: LoginRequest) {
    return this.authService.login(data.identifier, data.password);
  }

  @GrpcMethod('AuthService', 'Register')
  async register(data: RegisterRequest) {
    return this.authService.register(data.email, data.username, data.password);
  }

  @GrpcMethod('AuthService', 'Refresh')
  async refresh(data: RefreshRequest) {
    return this.authService.refresh(data.refreshToken, data.userId);
  }

  @GrpcMethod('AuthService', 'Logout')
  async logout(data: LogoutRequest) {
    return this.authService.logout(data.refreshToken, data.userId);
  }
  
  @GrpcMethod('AuthService', 'VerifyToken')
  async verifyToken(data: { token: string }) {
    return this.authService.verifyToken(data.token);
  }
}
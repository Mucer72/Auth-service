import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { LoginRequest } from '../../generated/auth';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginRequest: LoginRequest) {
    return this.authService.login(loginRequest);
  }

  @Post('register')
  async register(@Body() registerRequest: { email: string; username: string; password: string }) {
    return this.authService.register(registerRequest);
  }

  @Post('refresh')
  async refresh(@Body() refreshRequest: { refreshToken: string; userId: string }) {
    return this.authService.refresh(refreshRequest);
  }

  @Post('logout')
  async logout(@Body() logoutRequest: { refreshToken: string; userId: string }) {
    return this.authService.logout(logoutRequest);
  }
}
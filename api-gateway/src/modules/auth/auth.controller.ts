import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { LoginRequest, RegisterRequest } from '../../generated/auth';
import { JwtGuard } from 'src/common/guards/jwt.guard';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() loginRequest: LoginRequest) {
    return this.authService.login(loginRequest);
  }

  @Public()
  @Post('register')
  async register(@Body() registerRequest: RegisterRequest) {
    return this.authService.register(registerRequest);
  }

  @Post('refresh')
  async refresh(@Body() refreshRequest: { refreshToken: string; userId: string }) {
    return this.authService.refresh(refreshRequest);
  }

  @Post('logout')
  @UseGuards(JwtGuard)
  async logout(@Body() logoutRequest: { refreshToken: string, userId: string }) {
    return this.authService.logout(logoutRequest);
  }
}

import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from 'src/auth/dto/login.dto';
import { RegisterDto } from 'src/auth/dto/register.dto';
import { JwtGuard } from './guards/jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.username, dto.password);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string, @Req() req) {
    return this.authService.refresh(refreshToken, req.user.userId);
  }

  @UseGuards(JwtGuard)
  @Post('logout')
  logout(@Body('refreshToken') refreshToken: string, @Req() req) {
    return this.authService.logout(refreshToken, req.user.userId);
  }


  // import { UseGuards, Get, Req } from '@nestjs/common';

  // @UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
  // @Roles('admin')
  // @Permissions('user.create')
  // @Get('me')
  // getMe(@Req() req) {
  //   return req.user;
  // }
}
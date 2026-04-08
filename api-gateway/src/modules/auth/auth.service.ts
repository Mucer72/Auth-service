import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AuthClient } from '../../grpc/clients/auth.clients';
import { LoginRequest } from '../../generated/auth';

@Injectable()
export class AuthService {
  constructor(private authClient: AuthClient) {}

  async login(LoginRequest: LoginRequest) {
    return firstValueFrom(
      this.authClient.login(LoginRequest),
    );
  }

  async register(registerRequest: { email: string; username: string; password: string }) {
    return firstValueFrom(
      this.authClient.register(registerRequest),
    );
  }

  async refresh(refreshRequest: { refreshToken: string; userId: string }) {
    return firstValueFrom(
      this.authClient.refresh(refreshRequest),
    );
  }

  async logout(logoutRequest: { refreshToken: string; userId: string }) {
    return firstValueFrom(
      this.authClient.logout(logoutRequest),
    );
  }

  async verifyToken(token: string) {
    return firstValueFrom(
      this.authClient.verifyToken(token),
    );
  }
}
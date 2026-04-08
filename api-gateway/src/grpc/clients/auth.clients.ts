import type { ClientGrpc } from '@nestjs/microservices';
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { LoginRequest, RegisterRequest, RefreshRequest, LogoutRequest } from '../../generated/auth';

interface AuthService {
  login(data: LoginRequest): Observable<any>;
  verifyToken(data: { token: string }): Observable<any>;
  register(data: RegisterRequest): Observable<any>;
  refresh(data: RefreshRequest): Observable<any>;
  logout(data: LogoutRequest): Observable<any>;
}

@Injectable()
export class AuthClient implements OnModuleInit {
  private authService: AuthService;

  constructor(
    @Inject('AUTH_PACKAGE') private client: ClientGrpc,
  ){}

  onModuleInit() {
    this.authService = this.client.getService<AuthService>('AuthService');
  }

  login(data: LoginRequest) {
    return this.authService.login(data);
  }

  verifyToken(token: string) {
    return this.authService.verifyToken({ token });
  }

  register(data: RegisterRequest) {
    return this.authService.register(data);
  }

  refresh(data: RefreshRequest) {
    return this.authService.refresh(data);
  }

  logout(data: LogoutRequest) {
    return this.authService.logout(data);
  }
  }
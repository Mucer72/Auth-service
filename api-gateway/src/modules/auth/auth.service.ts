import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  NotImplementedException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { firstValueFrom, Observable } from 'rxjs';
import { AuthClient } from '../../grpc/clients/auth.clients';
import {
  LoginRequest,
  LogoutRequest,
  LogoutResponse,
  RefreshRequest,
  RegisterRequest,
  RegisterResponse,
  TokenPair,
  User,
} from '../../generated/auth';

type GrpcError = {
  code?: number;
  details?: string;
  message?: string;
};

type TokenPairLike = Partial<TokenPair> & {
  access_token?: string;
  refresh_token?: string;
};

type RegisterResponseLike = RegisterResponse | User;

type GatewayTokenPair = {
  access_token: string;
  refresh_token: string;
};

@Injectable()
export class AuthService {
  constructor(private authClient: AuthClient) {}

  async login(loginRequest: LoginRequest): Promise<GatewayTokenPair> {
    const response = await this.callGrpc(this.authClient.login(loginRequest));
    return this.normalizeTokenPair(response);
  }

  async register(registerRequest: RegisterRequest): Promise<User | undefined> {
    const response = await this.callGrpc(
      this.authClient.register(registerRequest),
    );
    return this.normalizeRegisterResponse(response);
  }

  async refresh(refreshRequest: RefreshRequest): Promise<GatewayTokenPair> {
    const response = await this.callGrpc(
      this.authClient.refresh(refreshRequest),
    );
    return this.normalizeTokenPair(response);
  }

  async logout(logoutRequest: LogoutRequest): Promise<string> {
    const response = await this.callGrpc(this.authClient.logout(logoutRequest));
    return this.normalizeLogoutResponse(response);
  }

  async verifyToken(token: string) {
    return this.callGrpc(this.authClient.verifyToken(token));
  }

  private async callGrpc<T>(request$: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request$);
    } catch (error) {
      throw this.mapGrpcErrorToHttpException(error);
    }
  }

  private normalizeTokenPair(response: TokenPairLike): GatewayTokenPair {
    return {
      access_token: response.accessToken ?? response.access_token ?? '',
      refresh_token: response.refreshToken ?? response.refresh_token ?? '',
    };
  }

  private normalizeRegisterResponse(
    response: RegisterResponseLike,
  ): User | undefined {
    if (this.isRegisterResponse(response)) {
      return response.user;
    }

    return response;
  }

  private normalizeLogoutResponse(response: LogoutResponse | string) {
    return typeof response === 'string' ? response : response.message;
  }

  private isRegisterResponse(
    response: RegisterResponseLike,
  ): response is RegisterResponse {
    return 'user' in response;
  }

  private mapGrpcErrorToHttpException(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    const grpcError = error as GrpcError;
    const message =
      grpcError.details?.trim() || grpcError.message || 'Internal server error';

    switch (grpcError.code) {
      case status.INVALID_ARGUMENT:
        return new BadRequestException(message);
      case status.UNAUTHENTICATED:
        return new UnauthorizedException(message);
      case status.PERMISSION_DENIED:
        return new ForbiddenException(message);
      case status.NOT_FOUND:
        return new NotFoundException(message);
      case status.ALREADY_EXISTS:
        return new ConflictException(message);
      case status.RESOURCE_EXHAUSTED:
        return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
      case status.UNIMPLEMENTED:
        return new NotImplementedException(message);
      case status.UNAVAILABLE:
        return new ServiceUnavailableException(message);
      case status.DEADLINE_EXCEEDED:
        return new GatewayTimeoutException(message);
      default:
        return new InternalServerErrorException(message);
    }
  }
}

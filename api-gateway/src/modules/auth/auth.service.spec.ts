import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { status } from '@grpc/grpc-js';
import { of, throwError } from 'rxjs';
import { AuthClient } from '../../grpc/clients/auth.clients';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let authClient: jest.Mocked<AuthClient>;

  beforeEach(async () => {
    authClient = {
      login: jest.fn(),
      verifyToken: jest.fn(),
      register: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    } as unknown as jest.Mocked<AuthClient>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthClient,
          useValue: authClient,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('normalizes token pairs to the auth-service http response shape', async () => {
    authClient.login.mockReturnValue(
      of({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }) as never,
    );

    await expect(
      service.login({
        identifier: 'penguin@example.com',
        password: 'password123',
      }),
    ).resolves.toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('unwraps register responses from grpc', async () => {
    const user = {
      id: 'user-1',
      email: 'penguin@example.com',
      username: 'penguin',
      roleId: 'role-1',
      createdAt: undefined,
      updatedAt: undefined,
    };

    authClient.register.mockReturnValue(of({ user }) as never);

    await expect(
      service.register({
        email: 'penguin@example.com',
        username: 'penguin',
        password: 'password123',
      }),
    ).resolves.toEqual(user);
  });

  it('unwraps logout responses from grpc', async () => {
    authClient.logout.mockReturnValue(
      of({ message: 'Logged out successfully' }) as never,
    );

    await expect(
      service.logout({
        refreshToken: 'refresh-token',
        userId: 'user-1',
      }),
    ).resolves.toBe('Logged out successfully');
  });

  it('maps invalid argument grpc errors to bad request http errors', async () => {
    authClient.register.mockReturnValue(
      throwError(() => ({
        code: status.INVALID_ARGUMENT,
        details: 'Email is required.',
      })) as never,
    );

    await expect(
      service.register({
        email: '',
        username: 'penguin',
        password: 'password123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps unauthenticated grpc errors to unauthorized http errors', async () => {
    authClient.login.mockReturnValue(
      throwError(() => ({
        code: status.UNAUTHENTICATED,
        details: 'Invalid credentials.',
      })) as never,
    );

    await expect(
      service.login({
        identifier: 'penguin@example.com',
        password: 'bad-password',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

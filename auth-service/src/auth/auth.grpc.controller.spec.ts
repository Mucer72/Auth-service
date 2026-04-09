import { Test, TestingModule } from '@nestjs/testing';
import { AuthGrpcController } from './auth.grpc.controller';
import { AuthService } from './auth.service';

describe('AuthGrpcController', () => {
  let controller: AuthGrpcController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      register: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      verifyToken: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthGrpcController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthGrpcController>(AuthGrpcController);
  });

  it('maps login responses to the grpc token pair shape', async () => {
    authService.login.mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    } as never);

    await expect(
      controller.login({
        identifier: 'penguin@example.com',
        password: 'password123',
      }),
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('wraps register responses in the grpc register response shape', async () => {
    authService.register.mockResolvedValue({
      id: 'user-1',
      email: 'penguin@example.com',
      username: 'penguin',
      roleId: 'role-1',
      createdAt: new Date('2026-01-01T00:00:01.500Z'),
      updatedAt: new Date('2026-01-01T00:00:02.250Z'),
    } as never);

    await expect(
      controller.register({
        email: 'penguin@example.com',
        username: 'penguin',
        password: 'password123',
      }),
    ).resolves.toEqual({
      user: {
        id: 'user-1',
        email: 'penguin@example.com',
        username: 'penguin',
        roleId: 'role-1',
        createdAt: {
          seconds: 1767225601,
          nanos: 500000000,
        },
        updatedAt: {
          seconds: 1767225602,
          nanos: 250000000,
        },
      },
    });
  });

  it('wraps logout responses in the grpc logout response shape', async () => {
    authService.logout.mockResolvedValue('Logged out successfully' as never);

    await expect(
      controller.logout({
        refreshToken: 'refresh-token',
        userId: 'user-1',
      }),
    ).resolves.toEqual({
      message: 'Logged out successfully',
    });
  });
});

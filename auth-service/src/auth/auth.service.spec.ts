import { AUTH_ERROR_MESSAGES } from './common/auth.exception';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './repository/refresh-token.repository';
import { RoleRepository } from './repository/role.repository';
import { UserRepository } from './repository/user.repository';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let roleRepository: jest.Mocked<RoleRepository>;
  let refreshTokenRepository: jest.Mocked<RefreshTokenRepository>;
  let jwtService: jest.Mocked<JwtService>;
  const originalMaxDevices = process.env.MAX_DEVICES;

  beforeEach(async () => {
    userRepository = {
      createUser: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    roleRepository = {
      getRolePermissionNames: jest.fn(),
    } as unknown as jest.Mocked<RoleRepository>;

    refreshTokenRepository = {
      save: jest.fn(),
      findByUserId: jest.fn(),
      findActiveByUserId: jest.fn(),
      revokeExpiredByUser: jest.fn(),
      revoke: jest.fn(),
      revokeMany: jest.fn(),
      revokeAllByUser: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokenRepository>;

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: userRepository },
        { provide: RoleRepository, useValue: roleRepository },
        {
          provide: RefreshTokenRepository,
          useValue: refreshTokenRepository,
        },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    process.env.MAX_DEVICES = '2';
  });

  afterEach(() => {
    jest.restoreAllMocks();

    if (originalMaxDevices === undefined) {
      delete process.env.MAX_DEVICES;
      return;
    }

    process.env.MAX_DEVICES = originalMaxDevices;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects registration when email is missing', async () => {
    await expect(
      service.register('', 'penguin', 'password123'),
    ).rejects.toThrow(AUTH_ERROR_MESSAGES.EMAIL_REQUIRED);
    expect(userRepository.createUser).not.toHaveBeenCalled();
  });

  it('maps duplicate email errors during registration', async () => {
    userRepository.createUser.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['email'] },
    } as never);

    await expect(
      service.register('penguin@example.com', 'penguin', 'password123'),
    ).rejects.toThrow(AUTH_ERROR_MESSAGES.DUPLICATE_EMAIL);
  });

  it('rejects login when the identifier is missing', async () => {
    await expect(service.login('', 'password123')).rejects.toThrow(
      AUTH_ERROR_MESSAGES.IDENTIFIER_REQUIRED,
    );
  });

  it('rejects login when credentials are invalid', async () => {
    userRepository.findByEmail.mockResolvedValue(null as never);

    await expect(
      service.login('penguin@example.com', 'password123'),
    ).rejects.toThrow(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
  });

  it('revokes the oldest active refresh token when the device limit is reached', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);

    userRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'penguin@example.com',
      passwordHash,
      roleId: 'role-1',
      role: {
        id: 'role-1',
        name: 'user',
      },
    } as never);
    roleRepository.getRolePermissionNames.mockResolvedValue([
      'users.read',
    ] as never);
    refreshTokenRepository.revokeExpiredByUser.mockResolvedValue({
      count: 0,
    } as never);
    refreshTokenRepository.findActiveByUserId.mockResolvedValue([
      {
        id: 'oldest-token',
        tokenHash: 'hash-1',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(Date.now() - 120_000),
      },
      {
        id: 'newer-token',
        tokenHash: 'hash-2',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(Date.now() - 60_000),
      },
    ] as never);
    refreshTokenRepository.revokeMany.mockResolvedValue({
      count: 1,
    } as never);
    refreshTokenRepository.save.mockResolvedValue({} as never);
    jwtService.sign.mockReturnValue('signed-access-token');

    const result = await service.login('penguin@example.com', 'password123');
    const [savedRefreshToken] = refreshTokenRepository.save.mock.calls[0];

    expect(refreshTokenRepository.revokeExpiredByUser).toHaveBeenCalledWith(
      'user-1',
    );
    expect(refreshTokenRepository.findActiveByUserId).toHaveBeenCalledWith(
      'user-1',
    );
    expect(refreshTokenRepository.revokeMany).toHaveBeenCalledWith([
      'oldest-token',
    ]);
    expect(savedRefreshToken.userId).toBe('user-1');
    expect(savedRefreshToken.tokenHash).toEqual(expect.any(String));
    expect(savedRefreshToken.tokenHash).not.toHaveLength(0);
    expect(savedRefreshToken.expiresAt).toEqual(expect.any(Date));
    expect(result).toEqual({
      access_token: 'signed-access-token',
      refresh_token: expect.any(String),
    });
  });

  it('rejects refresh when the refresh token is missing', async () => {
    await expect(service.refresh('', 'user-1')).rejects.toThrow(
      AUTH_ERROR_MESSAGES.REFRESH_TOKEN_REQUIRED,
    );
  });

  it('rejects expired refresh tokens and revokes them', async () => {
    const refreshToken = 'refresh-token';
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    refreshTokenRepository.findByUserId.mockResolvedValue([
      {
        id: 'expired-token',
        tokenHash,
        expiresAt: new Date(Date.now() - 1_000),
      },
    ] as never);

    await expect(service.refresh(refreshToken, 'user-1')).rejects.toThrow(
      AUTH_ERROR_MESSAGES.EXPIRED_REFRESH_TOKEN,
    );
    expect(refreshTokenRepository.revoke).toHaveBeenCalledWith('expired-token');
  });

  it('rejects refresh when no active token matches', async () => {
    const refreshToken = 'refresh-token';
    const tokenHash = await bcrypt.hash('different-token', 10);

    refreshTokenRepository.findByUserId.mockResolvedValue([
      {
        id: 'token-1',
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
      },
    ] as never);

    await expect(service.refresh(refreshToken, 'user-1')).rejects.toThrow(
      AUTH_ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
    );
  });

  it('uses the default device limit when MAX_DEVICES is not set', async () => {
    delete process.env.MAX_DEVICES;
    const defaultDeviceLimit = (service as any).getMaxDevices();

    const passwordHash = await bcrypt.hash('password123', 10);

    userRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'penguin@example.com',
      passwordHash,
      roleId: 'role-1',
      role: {
        id: 'role-1',
        name: 'user',
      },
    } as never);
    roleRepository.getRolePermissionNames.mockResolvedValue([
      'users.read',
    ] as never);
    refreshTokenRepository.revokeExpiredByUser.mockResolvedValue({
      count: 0,
    } as never);
    refreshTokenRepository.findActiveByUserId.mockResolvedValue(
      Array.from(
        { length: Math.max(0, defaultDeviceLimit - 1) },
        (_, index) => ({
          id: `token-${index + 1}`,
          tokenHash: `hash-${index + 1}`,
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(Date.now() - (index + 1) * 60_000),
        }),
      ) as never,
    );
    refreshTokenRepository.save.mockResolvedValue({} as never);
    jwtService.sign.mockReturnValue('signed-access-token');

    await service.login('penguin@example.com', 'password123');

    expect(refreshTokenRepository.revokeMany).not.toHaveBeenCalled();
    expect(refreshTokenRepository.save).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid MAX_DEVICES configuration', async () => {
    process.env.MAX_DEVICES = '0';
    const passwordHash = await bcrypt.hash('password123', 10);

    userRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'penguin@example.com',
      passwordHash,
      roleId: 'role-1',
      role: {
        id: 'role-1',
        name: 'user',
      },
    } as never);
    refreshTokenRepository.findActiveByUserId.mockResolvedValue([] as never);

    await expect(
      service.login('penguin@example.com', 'password123'),
    ).rejects.toThrow(AUTH_ERROR_MESSAGES.INVALID_MAX_DEVICES_CONFIG);
  });

  it('rejects token verification when the token user does not exist', async () => {
    jwtService.verify.mockReturnValue({ sub: 'missing-user' } as never);
    userRepository.findById.mockResolvedValue(null as never);

    await expect(service.verifyToken('valid-token')).rejects.toThrow(
      AUTH_ERROR_MESSAGES.TOKEN_USER_NOT_FOUND,
    );
  });

  it('rejects token verification when the token is invalid', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    await expect(service.verifyToken('bad-token')).rejects.toThrow(
      AUTH_ERROR_MESSAGES.INVALID_TOKEN,
    );
  });
});

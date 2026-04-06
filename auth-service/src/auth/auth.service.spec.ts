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
  const originalMaxDeviceSessions = process.env.MAX_DEVICE_SESSIONS;

  beforeEach(async () => {
    userRepository = {
      createUser: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
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
    process.env.MAX_DEVICE_SESSIONS = '2';
  });

  afterEach(() => {
    jest.restoreAllMocks();

    if (originalMaxDeviceSessions === undefined) {
      delete process.env.MAX_DEVICE_SESSIONS;
      return;
    }

    process.env.MAX_DEVICE_SESSIONS = originalMaxDeviceSessions;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
});

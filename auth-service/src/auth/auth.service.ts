import { HttpException, Injectable } from '@nestjs/common';
import { UserRepository } from './repository/user.repository';
import { RoleRepository } from './repository/role.repository';
import { RefreshTokenRepository } from './repository/refresh-token.repository';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import {
  AuthExceptions,
  rethrowUserCreationError,
} from './common/auth.exception';

const DEFAULT_MAX_DEVICES = 1;
const DEFAULT_REFRESH_TOKEN_EXPIRATION_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly jwtService: JwtService,
  ) {}

  async verifyToken(token: string) {
    this.assertRequired(token, AuthExceptions.tokenRequired);

    try {
      const payload = this.jwtService.verify(token);
      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        throw AuthExceptions.tokenUserNotFound();
      }
      return user;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw AuthExceptions.invalidToken();
    }
  }

  async register(email: string, username: string, password: string) {
    this.assertRequired(email, AuthExceptions.emailRequired);
    this.assertRequired(username, AuthExceptions.usernameRequired);
    this.assertRequired(password, AuthExceptions.passwordRequired);

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      return await this.userRepository.createUser(
        { email, username, passwordHash },
        'user',
      );
    } catch (error) {
      rethrowUserCreationError(error);
    }
  }

  async login(identifier: string, password: string) {
    this.assertRequired(identifier, AuthExceptions.identifierRequired);
    this.assertRequired(password, AuthExceptions.passwordRequired);

    const user = identifier.includes('@')
      ? await this.userRepository.findByEmail(identifier)
      : await this.userRepository.findByUsername(identifier);

    if (!user) {
      throw AuthExceptions.invalidCredentials();
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw AuthExceptions.invalidCredentials();
    }

    await this.enforceDeviceLimit(user.id);

    const permissions = await this.roleRepository.getRolePermissionNames(
      user.roleId,
    );

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });

    const refreshToken = randomUUID();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.refreshTokenRepository.save({
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: this.getRefreshTokenExpiry(),
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refresh(refreshToken: string, userId: string) {
    this.assertRequired(refreshToken, AuthExceptions.refreshTokenRequired);
    this.assertRequired(userId, AuthExceptions.userIdRequired);

    const tokens = await this.refreshTokenRepository.findByUserId(userId);
    const now = new Date();

    for (const token of tokens) {
      const isMatch = await bcrypt.compare(refreshToken, token.tokenHash);

      if (!isMatch) {
        continue;
      }

      if (token.expiresAt <= now) {
        await this.refreshTokenRepository.revoke(token.id);
        throw AuthExceptions.expiredRefreshToken();
      }

      // rotate token (best practice)
      await this.refreshTokenRepository.revoke(token.id);

      const newRefreshToken = randomUUID();
      const newHash = await bcrypt.hash(newRefreshToken, 10);

      await this.refreshTokenRepository.save({
        userId,
        tokenHash: newHash,
        expiresAt: this.getRefreshTokenExpiry(),
      });

      const newAccessToken = this.jwtService.sign(
        { sub: userId },
        { expiresIn: '1h' },
      );

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      };
    }

    throw AuthExceptions.invalidRefreshToken();
  }

  async logout(refreshToken: string, userId: string) {
    this.assertRequired(refreshToken, AuthExceptions.refreshTokenRequired);
    this.assertRequired(userId, AuthExceptions.userIdRequired);

    const tokens = await this.refreshTokenRepository.findByUserId(userId);

    for (const token of tokens) {
      const isMatch = await bcrypt.compare(refreshToken, token.tokenHash);

      if (isMatch) {
        await this.refreshTokenRepository.revoke(token.id);
        return 'Logged out successfully';
      }
    }

    throw AuthExceptions.invalidRefreshToken();
  }

  private async enforceDeviceLimit(userId: string) {
    await this.refreshTokenRepository.revokeExpiredByUser(userId);

    const activeTokens =
      await this.refreshTokenRepository.findActiveByUserId(userId);
    const overflowCount = activeTokens.length - this.getMaxDevices() + 1;
    if (overflowCount <= 0) {
      return;
    }

    // Revoke the oldest active sessions first to make room for this login.
    await this.refreshTokenRepository.revokeMany(
      activeTokens.slice(0, overflowCount).map((token) => token.id),
    );
  }

  private getMaxDevices() {
    return this.parsePositiveInteger(
      process.env.MAX_DEVICES,
      DEFAULT_MAX_DEVICES,
      AuthExceptions.invalidMaxDevicesConfig,
    );
  }

  private getRefreshTokenExpiry() {
    const expirationDays = this.parsePositiveInteger(
      process.env.REFRESH_TOKEN_EXPIRATION,
      DEFAULT_REFRESH_TOKEN_EXPIRATION_DAYS,
      AuthExceptions.invalidRefreshTokenExpirationConfig,
    );

    return new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
  }

  private assertRequired(
    value: string | null | undefined,
    exceptionFactory: () => HttpException,
  ) {
    if (!value?.trim()) {
      throw exceptionFactory();
    }
  }

  private parsePositiveInteger(
    value: string | undefined,
    fallbackValue: number,
    exceptionFactory: () => HttpException,
  ) {
    if (!value?.trim()) {
      return fallbackValue;
    }

    const parsedValue = Number(value);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      throw exceptionFactory();
    }

    return parsedValue;
  }
}

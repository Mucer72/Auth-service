import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from './repository/user.repository';
import { RoleRepository } from './repository/role.repository';
import { RefreshTokenRepository } from './repository/refresh-token.repository';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly jwtService: JwtService,
  ) {}

  async verifyToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return user;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }
  
  async register(email: string, username: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 10);

    return this.userRepository.createUser(
      { email, username, passwordHash },
      'user',
    );
  }

  async login(identifier: string, password: string) {
    const user = identifier.includes('@')
      ? await this.userRepository.findByEmail(identifier)
      : await this.userRepository.findByUsername(identifier);

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

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
    const tokens = await this.refreshTokenRepository.findByUserId(userId);

    for (const token of tokens) {
      const isMatch = await bcrypt.compare(refreshToken, token.tokenHash);

      if (isMatch && token.expiresAt > new Date()) {
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
    }

    throw new UnauthorizedException();
  }

  async logout(refreshToken: string, userId: string) {
    const tokens = await this.refreshTokenRepository.findByUserId(userId);

    for (const token of tokens) {
      const isMatch = await bcrypt.compare(refreshToken, token.tokenHash);

      if (isMatch) {
        await this.refreshTokenRepository.revoke(token.id);
        return 'Logged out successfully';
      }
    }

    throw new UnauthorizedException('Invalid refresh token');
  }

  private async enforceDeviceLimit(userId: string) {
    await this.refreshTokenRepository.revokeExpiredByUser(userId);

    const activeTokens = await this.refreshTokenRepository.findActiveByUserId(
      userId,
    );
    const overflowCount = activeTokens.length - this.getMaxDevices() + 1;
    console.log(`max devices: ${this.getMaxDevices()}`);
    console.log(`Active sessions: ${activeTokens.length}, Overflow: ${overflowCount}`);
    if (overflowCount <= 0) {
      return;
    }

    // Revoke the oldest active sessions first to make room for this login.
    await this.refreshTokenRepository.revokeMany(
      activeTokens.slice(0, overflowCount).map((token) => token.id),
    );
  }

  private getMaxDevices() {
    return Number.parseInt(
      process.env.MAX_DEVICES!
    );
  }

  private getRefreshTokenExpiry() {
    return new Date(
      Date.now() + (Number.parseInt(process.env.REFRESH_TOKEN_EXPIRATION!))  
      * 24 * 60 * 60 * 1000);
  }
} 

import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

type PrismaLikeError = {
  code?: string;
  meta?: {
    target?: string | string[];
  };
};

export const AUTH_ERROR_MESSAGES = {
  EMAIL_REQUIRED: 'Email is required.',
  USERNAME_REQUIRED: 'Username is required.',
  PASSWORD_REQUIRED: 'Password is required.',
  IDENTIFIER_REQUIRED: 'Email or username is required.',
  TOKEN_REQUIRED: 'Access token is required.',
  USER_ID_REQUIRED: 'User ID is required.',
  REFRESH_TOKEN_REQUIRED: 'Refresh token is required.',
  INVALID_CREDENTIALS: 'Invalid credentials.',
  INVALID_TOKEN: 'Invalid token.',
  TOKEN_USER_NOT_FOUND: 'User for this token was not found.',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token.',
  EXPIRED_REFRESH_TOKEN: 'Refresh token has expired.',
  DUPLICATE_EMAIL: 'An account with this email already exists.',
  DUPLICATE_USERNAME: 'An account with this username already exists.',
  DUPLICATE_ACCOUNT: 'An account with these details already exists.',
  DEFAULT_ROLE_NOT_FOUND: "Default role 'user' is not configured.",
  INVALID_MAX_DEVICES_CONFIG: "Auth service configuration 'MAX_DEVICES' must be a positive integer.",
  INVALID_REFRESH_TOKEN_EXPIRATION_CONFIG: "Auth service configuration 'REFRESH_TOKEN_EXPIRATION' must be a positive integer.",
} as const;

function getPrismaUniqueTargets(error: PrismaLikeError) {
  if (!error.meta?.target) {
    return [];
  }

  return Array.isArray(error.meta.target)
    ? error.meta.target
    : [error.meta.target];
}

export function rethrowIfHttpException(error: unknown): never | void {
  if (error instanceof HttpException) {
    throw error;
  }
}

export function rethrowUserCreationError(error: unknown): never {
  rethrowIfHttpException(error);

  const prismaError = error as PrismaLikeError | null;
  if (prismaError?.code === 'P2002') {
    const targets = getPrismaUniqueTargets(prismaError);

    if (targets.includes('email')) {
      throw AuthExceptions.duplicateEmail();
    }

    if (targets.includes('username')) {
      throw AuthExceptions.duplicateUsername();
    }

    throw AuthExceptions.duplicateAccount();
  }

  throw error;
}

export const AuthExceptions = {
  emailRequired: () =>
    new BadRequestException(AUTH_ERROR_MESSAGES.EMAIL_REQUIRED),
  usernameRequired: () =>
    new BadRequestException(AUTH_ERROR_MESSAGES.USERNAME_REQUIRED),
  passwordRequired: () =>
    new BadRequestException(AUTH_ERROR_MESSAGES.PASSWORD_REQUIRED),
  identifierRequired: () =>
    new BadRequestException(AUTH_ERROR_MESSAGES.IDENTIFIER_REQUIRED),
  tokenRequired: () =>
    new BadRequestException(AUTH_ERROR_MESSAGES.TOKEN_REQUIRED),
  userIdRequired: () =>
    new BadRequestException(AUTH_ERROR_MESSAGES.USER_ID_REQUIRED),
  refreshTokenRequired: () =>
    new BadRequestException(AUTH_ERROR_MESSAGES.REFRESH_TOKEN_REQUIRED),
  invalidCredentials: () =>
    new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS),
  invalidToken: () =>
    new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN),
  tokenUserNotFound: () =>
    new UnauthorizedException(AUTH_ERROR_MESSAGES.TOKEN_USER_NOT_FOUND),
  invalidRefreshToken: () =>
    new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_REFRESH_TOKEN),
  expiredRefreshToken: () =>
    new UnauthorizedException(AUTH_ERROR_MESSAGES.EXPIRED_REFRESH_TOKEN),
  duplicateEmail: () =>
    new ConflictException(AUTH_ERROR_MESSAGES.DUPLICATE_EMAIL),
  duplicateUsername: () =>
    new ConflictException(AUTH_ERROR_MESSAGES.DUPLICATE_USERNAME),
  duplicateAccount: () =>
    new ConflictException(AUTH_ERROR_MESSAGES.DUPLICATE_ACCOUNT),
  defaultRoleNotFound: () =>
    new InternalServerErrorException(
      AUTH_ERROR_MESSAGES.DEFAULT_ROLE_NOT_FOUND,
    ),
  invalidMaxDevicesConfig: () =>
    new InternalServerErrorException(
      AUTH_ERROR_MESSAGES.INVALID_MAX_DEVICES_CONFIG,
    ),
  invalidRefreshTokenExpirationConfig: () =>
    new InternalServerErrorException(
      AUTH_ERROR_MESSAGES.INVALID_REFRESH_TOKEN_EXPIRATION_CONFIG,
    ),
};

import { ExecutionContext } from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { lastValueFrom, throwError } from 'rxjs';
import { AUTH_ERROR_MESSAGES, AuthExceptions } from './auth.exception';
import { GrpcErrorInterceptor } from './grpc-error.interceptor';

describe('GrpcErrorInterceptor', () => {
  const interceptor = new GrpcErrorInterceptor();

  it('maps auth exceptions to grpc status codes', async () => {
    const next = {
      handle: () => throwError(() => AuthExceptions.invalidCredentials()),
    };

    try {
      await lastValueFrom(interceptor.intercept({} as ExecutionContext, next));
      fail('Expected RpcException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RpcException);

      const rpcError = (error as RpcException).getError() as {
        code: number;
        message: string;
        details: string;
      };

      expect(rpcError).toEqual({
        code: status.UNAUTHENTICATED,
        message: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS,
        details: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS,
      });
    }
  });

  it('maps unknown errors to internal grpc errors', async () => {
    const next = {
      handle: () => throwError(() => new Error('Unexpected failure')),
    };

    try {
      await lastValueFrom(interceptor.intercept({} as ExecutionContext, next));
      fail('Expected RpcException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RpcException);

      const rpcError = (error as RpcException).getError() as {
        code: number;
        message: string;
        details: string;
      };

      expect(rpcError).toEqual({
        code: status.INTERNAL,
        message: 'Unexpected failure',
        details: 'Unexpected failure',
      });
    }
  });
});

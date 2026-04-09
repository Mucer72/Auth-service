import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { Observable, catchError, throwError } from 'rxjs';

type HttpExceptionResponse =
  | string
  | {
      message?: string | string[];
    };

export type GrpcErrorPayload = {
  code: number;
  message: string;
  details: string;
};

export function mapHttpStatusToGrpcCode(httpStatusCode: number) {
  switch (httpStatusCode) {
    case 400:
    case 422:
      return status.INVALID_ARGUMENT;
    case 401:
      return status.UNAUTHENTICATED;
    case 403:
      return status.PERMISSION_DENIED;
    case 404:
      return status.NOT_FOUND;
    case 409:
      return status.ALREADY_EXISTS;
    case 429:
      return status.RESOURCE_EXHAUSTED;
    case 499:
      return status.CANCELLED;
    case 501:
      return status.UNIMPLEMENTED;
    case 503:
      return status.UNAVAILABLE;
    case 504:
      return status.DEADLINE_EXCEEDED;
    default:
      return httpStatusCode >= 500 ? status.INTERNAL : status.UNKNOWN;
  }
}

function getHttpExceptionMessage(exception: HttpException) {
  const response = exception.getResponse() as HttpExceptionResponse;

  if (typeof response === 'string') {
    return response;
  }

  if (Array.isArray(response?.message)) {
    return response.message.join(', ');
  }

  if (typeof response?.message === 'string') {
    return response.message;
  }

  return exception.message;
}

export function createGrpcErrorPayload(
  exception: HttpException,
): GrpcErrorPayload {
  const message = getHttpExceptionMessage(exception);

  return {
    code: mapHttpStatusToGrpcCode(exception.getStatus()),
    message,
    details: message,
  };
}

@Injectable()
export class GrpcErrorInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (error instanceof RpcException) {
          return throwError(() => error);
        }

        if (error instanceof HttpException) {
          return throwError(
            () => new RpcException(createGrpcErrorPayload(error)),
          );
        }

        const message =
          error instanceof Error ? error.message : 'Internal server error';

        return throwError(
          () =>
            new RpcException({
              code: status.INTERNAL,
              message,
              details: message,
            }),
        );
      }),
    );
  }
}

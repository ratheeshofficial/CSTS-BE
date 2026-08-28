import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ApiErrorResponse } from '../interfaces/api-error-response.interface';

const HTTP_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.buildErrorResponse(exception);
    response.status(body.statusCode).json(body);
  }

  private buildErrorResponse(exception: unknown): ApiErrorResponse {
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      return {
        statusCode,
        message: this.extractMessage(exceptionResponse, statusCode),
        error:
          this.extractErrorName(exceptionResponse) ??
          HTTP_ERROR_NAMES[statusCode] ??
          'Error',
        timestamp,
      };
    }

    if (this.isUniqueViolation(exception)) {
      return {
        statusCode: HttpStatus.CONFLICT,
        message: 'Resource already exists',
        error: HTTP_ERROR_NAMES[HttpStatus.CONFLICT],
        timestamp,
      };
    }

    this.logger.error(
      exception instanceof Error ? exception.message : 'Unexpected error',
      exception instanceof Error ? exception.stack : undefined,
    );

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: HTTP_ERROR_NAMES[HttpStatus.INTERNAL_SERVER_ERROR],
      timestamp,
    };
  }

  private extractMessage(
    exceptionResponse: string | object,
    statusCode: number,
  ): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    const message = (exceptionResponse as { message?: string | string[] })
      .message;

    if (Array.isArray(message)) {
      return 'Validation failed';
    }

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }

    return HTTP_ERROR_NAMES[statusCode] ?? 'Error';
  }

  private extractErrorName(
    exceptionResponse: string | object,
  ): string | undefined {
    if (typeof exceptionResponse !== 'object' || exceptionResponse === null) {
      return undefined;
    }

    const error = (exceptionResponse as { error?: unknown }).error;
    return typeof error === 'string' ? error : undefined;
  }

  private isUniqueViolation(exception: unknown): boolean {
    if (!(exception instanceof QueryFailedError)) {
      return false;
    }

    const withCode = exception as QueryFailedError & {
      code?: string;
      driverError?: { code?: string };
    };

    return withCode.code === '23505' || withCode.driverError?.code === '23505';
  }
}

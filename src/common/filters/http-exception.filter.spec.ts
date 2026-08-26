import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let json: jest.Mock;
  let status: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps HttpException status, message, and error name', () => {
    filter.catch(new UnauthorizedException('Invalid credentials'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: 'Invalid credentials',
        error: 'Unauthorized',
        timestamp: expect.any(String),
      }),
    );
  });

  it('maps ForbiddenException, NotFoundException, and ConflictException', () => {
    filter.catch(new ForbiddenException('Insufficient permissions'), host);
    expect(json).toHaveBeenLastCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Insufficient permissions',
        error: 'Forbidden',
      }),
    );

    filter.catch(new NotFoundException('Ticket not found'), host);
    expect(json).toHaveBeenLastCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Ticket not found',
        error: 'Not Found',
      }),
    );

    filter.catch(new ConflictException('Email is already registered'), host);
    expect(json).toHaveBeenLastCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'Email is already registered',
        error: 'Conflict',
      }),
    );
  });

  it('collapses validation message arrays to Validation failed', () => {
    filter.catch(new BadRequestException(['email must be an email']), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
      }),
    );
  });

  it('maps Postgres unique violations to 409 Resource already exists', () => {
    const error = new QueryFailedError('INSERT', [], new Error('duplicate'));
    (error as QueryFailedError & { code?: string }).code = '23505';

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'Resource already exists',
        error: 'Conflict',
      }),
    );
  });

  it('maps unknown errors to 500 Internal server error', () => {
    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      }),
    );
  });
});

import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { QueryFailedError } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<
    UsersService,
    'findByEmail' | 'findByEmailWithPassword' | 'findById' | 'create'
  >>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;

  const now = new Date('2026-01-15T10:00:00.000Z');

  const user: User = {
    id: 'user-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    passwordHash: 'hashed-password',
    role: UserRole.CUSTOMER,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdTickets: [],
    assignedTickets: [],
    comments: [],
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
    mockedBcrypt.hash.mockReset();
    mockedBcrypt.compare.mockReset();
  });

  describe('register', () => {
    const dto = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password123',
    };

    it('hashes the password, creates a customer, and returns a JWT', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      usersService.create.mockResolvedValue(user);

      const result = await service.register(dto);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(usersService.create).toHaveBeenCalledWith({
        name: dto.name,
        email: dto.email,
        passwordHash: 'hashed-password',
        role: UserRole.CUSTOMER,
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
        role: UserRole.CUSTOMER,
      });
      expect(result).toEqual({
        accessToken: 'signed-token',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: UserRole.CUSTOMER,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      });
    });

    it('throws ConflictException when the email is already registered', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.register(dto)).rejects.toThrow(
        'Email is already registered',
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException on a unique violation from the database', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      const uniqueError = new QueryFailedError('INSERT', [], new Error());
      (uniqueError as QueryFailedError & { code?: string }).code = '23505';
      usersService.create.mockRejectedValue(uniqueError);

      await expect(service.register(dto)).rejects.toThrow(
        'Email is already registered',
      );
    });
  });

  describe('login', () => {
    const dto = { email: 'jane@example.com', password: 'password123' };

    it('returns a token when credentials are valid', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.login(dto);

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashed-password',
      );
      expect(result.accessToken).toBe('signed-token');
      expect(result.user.email).toBe(user.email);
    });

    it('throws UnauthorizedException when the user is not found', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
    });

    it('throws UnauthorizedException when the user is inactive', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue({
        ...user,
        isActive: false,
      });

      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('getCurrentUser', () => {
    it('returns the public user when active', async () => {
      usersService.findById.mockResolvedValue(user);

      await expect(service.getCurrentUser(user.id)).resolves.toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    it('throws UnauthorizedException when the user is missing', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.getCurrentUser('missing')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the user is inactive', async () => {
      usersService.findById.mockResolvedValue({ ...user, isActive: false });

      await expect(service.getCurrentUser(user.id)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});

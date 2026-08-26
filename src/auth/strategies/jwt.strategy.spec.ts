import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { User, UserRole } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { JwtPayload, JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: jest.Mocked<Pick<UsersService, 'findById'>>;

  const payload: JwtPayload = {
    sub: 'user-1',
    email: 'stale@example.com',
    role: UserRole.ADMIN,
  };

  const dbUser: User = {
    id: 'user-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    passwordHash: 'hash',
    role: UserRole.CUSTOMER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdTickets: [],
    assignedTickets: [],
    comments: [],
  };

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: usersService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('returns AuthUser from the database, not JWT claims', async () => {
    usersService.findById.mockResolvedValue(dbUser);

    await expect(strategy.validate(payload)).resolves.toEqual({
      id: 'user-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: UserRole.CUSTOMER,
    });
  });

  it('throws UnauthorizedException when the user is missing', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when the user is inactive', async () => {
    usersService.findById.mockResolvedValue({ ...dbUser, isActive: false });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

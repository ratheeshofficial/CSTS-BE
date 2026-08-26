import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const user: User = {
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
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repository },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('creates and saves a user', async () => {
    const data = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      passwordHash: 'hash',
      role: UserRole.CUSTOMER,
    };
    repository.create.mockReturnValue(user);
    repository.save.mockResolvedValue(user);

    await expect(service.create(data)).resolves.toEqual(user);
    expect(repository.create).toHaveBeenCalledWith(data);
    expect(repository.save).toHaveBeenCalledWith(user);
  });

  it('finds a user by email', async () => {
    repository.findOne.mockResolvedValue(user);

    await expect(service.findByEmail(user.email)).resolves.toEqual(user);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { email: user.email },
    });
  });

  it('finds a user by id', async () => {
    repository.findOne.mockResolvedValue(user);

    await expect(service.findById(user.id)).resolves.toEqual(user);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: user.id },
    });
  });

  it('loads passwordHash via query builder', async () => {
    const qb = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(user),
    };
    repository.createQueryBuilder.mockReturnValue(qb);

    await expect(service.findByEmailWithPassword(user.email)).resolves.toEqual(
      user,
    );
    expect(repository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(qb.addSelect).toHaveBeenCalledWith('user.passwordHash');
    expect(qb.where).toHaveBeenCalledWith('user.email = :email', {
      email: user.email,
    });
  });
});

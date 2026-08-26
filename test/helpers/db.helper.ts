import * as bcrypt from 'bcrypt';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../../src/users/entities/user.entity';
import { UsersService } from '../../src/users/users.service';

export async function truncateDb(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE comments, tickets, users RESTART IDENTITY CASCADE',
  );
}

export async function seedUser(
  app: INestApplication,
  data: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  },
): Promise<User> {
  const usersService = app.get(UsersService);
  const passwordHash = await bcrypt.hash(data.password, 10);
  return usersService.create({
    name: data.name,
    email: data.email,
    passwordHash,
    role: data.role,
  });
}

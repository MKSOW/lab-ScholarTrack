// UsersController imports UsersService, which imports `../auth/auth` (Better Auth, ESM).
// We mock that module to avoid the ESM load at controller require time.
jest.mock('../auth/auth', () => ({
  auth: { api: { signUpEmail: jest.fn() } },
}));

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// The controller is a simple pass-through: we verify it delegates to the service
// with the right arguments and returns what the service returns.
describe('UsersController', () => {
  let controller: UsersController;
  let service: { create: jest.Mock };

  beforeEach(() => {
    service = { create: jest.fn() };
    controller = new UsersController(service as unknown as UsersService);
  });

  it('delegates create() to UsersService', async () => {
    const dto = {
      email: 'a@b.com',
      name: 'A',
      password: 'password123',
      role: 'STUDENT' as const,
    };
    const created = { id: 'u-1' };
    service.create.mockResolvedValue(created);

    await expect(controller.create(dto)).resolves.toBe(created);
    expect(service.create).toHaveBeenCalledWith(dto);
  });
});

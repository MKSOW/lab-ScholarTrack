// UsersController importe UsersService, qui importe `../auth/auth` (Better Auth, ESM).
// On mocke ce module pour éviter le chargement ESM au require du controller.
jest.mock('../auth/auth', () => ({
  auth: { api: { signUpEmail: jest.fn() } },
}));

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Le controller est un simple pass-through : on vérifie qu'il délègue au service
// avec les bons arguments et qu'il retourne ce que le service renvoie.
describe('UsersController', () => {
  let controller: UsersController;
  let service: { create: jest.Mock };

  beforeEach(() => {
    service = { create: jest.fn() };
    controller = new UsersController(service as unknown as UsersService);
  });

  it('délègue create() au UsersService', async () => {
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

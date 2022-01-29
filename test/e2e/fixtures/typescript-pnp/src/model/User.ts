import { Role } from './Role';

type User = {
  id: string;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
};

function getUserName(user: User): string {
  return [user.firstName, user.lastName].filter((name) => name !== undefined).join(' ');
}

export { User, getUserName };

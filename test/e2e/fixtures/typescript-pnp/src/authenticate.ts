import { User } from './model/User';

async function login(email: string, password: string): Promise<User> {
  const response = await fetch('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}

async function logout(): Promise<any> {
  const response = await fetch('/logout', {
    method: 'POST',
  });
  return response.json();
}

export { login, logout };

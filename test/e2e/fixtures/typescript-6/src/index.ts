import { login } from './authenticate';
import { getUserName } from './model/User';

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginForm = document.getElementById('login');

if (!emailInput) {
  throw new Error('Cannot find #email input.');
}
if (!passwordInput) {
  throw new Error('Cannot find #password input.');
}
if (!loginForm) {
  throw new Error('Cannot find #login form.');
}

let email = '';
let password = '';

emailInput.addEventListener('change', (event) => {
  if (event.target instanceof HTMLInputElement) {
    email = event.target.value;
  }
});
passwordInput.addEventListener('change', (event) => {
  if (event.target instanceof HTMLInputElement) {
    password = event.target.value;
  }
});
loginForm.addEventListener('submit', async (event) => {
  const user = await login(email, password);

  if (user.role === 'admin') {
    console.log(`Logged in as ${getUserName(user)} [admin].`);
  } else {
    console.log(`Logged in as ${getUserName(user)}`);
  }
});

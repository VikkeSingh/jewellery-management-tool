import readline from 'readline';
import bcrypt from 'bcryptjs';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter the login password you want to use: ', async (password) => {
  if (!password || password.length < 4) {
    console.error('Please choose a password with at least 4 characters.');
    rl.close();
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  console.log('\nCopy this value into the APP_PASSWORD_HASH environment variable (in Vercel and your local .env):\n');
  console.log(hash);
  console.log('\n(The plaintext password above was not saved anywhere and does not need to be shared.)');
  rl.close();
});

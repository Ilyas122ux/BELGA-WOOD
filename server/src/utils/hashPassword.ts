import bcrypt from 'bcrypt';

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Usage: npm run hash-password -- "VotreMotDePasseDe8CaracteresMinimum"');
  process.exit(1);
}

console.log(await bcrypt.hash(password, 12));

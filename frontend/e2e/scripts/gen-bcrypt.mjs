import bcrypt from 'bcryptjs';

const password = 'Test@1234';
const hash = bcrypt.hashSync(password, 10);
const ok = bcrypt.compareSync(password, hash);
console.log('hash:', hash);
console.log('self-match:', ok);

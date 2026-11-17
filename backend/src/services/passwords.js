const bcrypt = require("bcryptjs");

const ROUNDS = 10;
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", ROUNDS);

function hashPassword(password) {
  return bcrypt.hash(password, ROUNDS);
}

async function verifyPassword(password, hash) {
  const matches = await bcrypt.compare(password, hash || DUMMY_HASH);
  return Boolean(hash) && matches;
}

module.exports = { hashPassword, verifyPassword };

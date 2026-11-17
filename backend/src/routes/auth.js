const HttpError = require("../utils/httpError");
const { normalizeEmail, validatePassword, normalizeName } = require("../utils/validators");
const { toUserDto } = require("../services/dto");

const DUPLICATE_KEY = 11000;

function createAuthHandlers({ User, hashPassword, verifyPassword, tokens }) {
  return {
    async register(req, res) {
      const body = req.body || {};
      const email = normalizeEmail(body.email);
      const password = validatePassword(body.password);
      const name = normalizeName(body.name);

      if (await User.findOne({ email })) {
        throw new HttpError(409, "An account with this email already exists");
      }

      let user;
      try {
        user = await User.create({ email, name, passwordHash: await hashPassword(password) });
      } catch (error) {
        if (error.code === DUPLICATE_KEY) {
          throw new HttpError(409, "An account with this email already exists");
        }
        throw error;
      }
      res.status(201).json({ token: tokens.sign(user._id), user: toUserDto(user) });
    },

    async login(req, res) {
      const body = req.body || {};
      const email = normalizeEmail(body.email);
      if (typeof body.password !== "string") throw new HttpError(400, "Password is required");

      const user = await User.findOne({ email });
      const valid = await verifyPassword(body.password, user && user.passwordHash);
      if (!user || !valid) throw new HttpError(401, "Invalid email or password");

      res.json({ token: tokens.sign(user._id), user: toUserDto(user) });
    },

    async me(req, res) {
      const user = await User.findById(req.userId);
      if (!user) throw new HttpError(401, "Account no longer exists");
      res.json({ user: toUserDto(user) });
    },
  };
}

module.exports = { createAuthHandlers };

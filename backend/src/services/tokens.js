const jwt = require("jsonwebtoken");

function createTokenService(secret, expiresIn = "7d") {
  return {
    sign(userId) {
      return jwt.sign({}, secret, { algorithm: "HS256", subject: String(userId), expiresIn });
    },
    verify(token) {
      return jwt.verify(token, secret, { algorithms: ["HS256"] }).sub;
    },
  };
}

module.exports = { createTokenService };

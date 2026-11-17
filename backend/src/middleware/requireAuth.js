const HttpError = require("../utils/httpError");

function requireAuth(tokens) {
  return (req, res, next) => {
    const [scheme, token] = (req.headers.authorization || "").split(" ");
    if (scheme !== "Bearer" || !token) return next(new HttpError(401, "Authentication required"));
    try {
      req.userId = tokens.verify(token);
      next();
    } catch {
      next(new HttpError(401, "Invalid or expired token"));
    }
  };
}

module.exports = { requireAuth };

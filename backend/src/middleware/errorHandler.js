const HttpError = require("../utils/httpError");

function notFound(req, res, next) {
  next(new HttpError(404, "Route not found"));
}

function errorHandler(error, req, res, next) {
  const status = error.status || 500;
  if (status === 500) console.error(error);
  res.status(status).json({
    error: { message: status === 500 ? "Internal server error" : error.message },
  });
}

module.exports = { notFound, errorHandler };

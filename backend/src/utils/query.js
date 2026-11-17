const HttpError = require("./httpError");

function positiveInt(value, name, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new HttpError(400, `${name} must be a positive integer`);
  }
  const number = Number(value);
  if (number < 1 || number > max) throw new HttpError(400, `${name} must be between 1 and ${max}`);
  return number;
}

function parsePagination(query) {
  const page = positiveInt(query.page, "page", 1, 100000);
  const limit = positiveInt(query.limit, "limit", 20, 100);
  return { page, limit, skip: (page - 1) * limit };
}

function parseDays(value) {
  return positiveInt(value, "days", 30, 365);
}

function paginated(items, total, { page, limit }) {
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

module.exports = { parsePagination, parseDays, paginated };

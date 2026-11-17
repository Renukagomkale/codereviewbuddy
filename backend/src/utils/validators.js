const HttpError = require("./httpError");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const RULE_ID = /^[a-z0-9-]{1,50}$/;
const MAX_DISABLED_RULES = 50;

function normalizeEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) throw new HttpError(400, "A valid email is required");
  return email;
}

function validatePassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 72) {
    throw new HttpError(400, "Password must be between 8 and 72 characters");
  }
  return value;
}

function normalizeName(value) {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.trim().length > 80) {
    throw new HttpError(400, "Name must be at most 80 characters");
  }
  return value.trim();
}

function parseFullName(value) {
  const fullName = typeof value === "string" ? value.trim() : "";
  if (!FULL_NAME.test(fullName) || fullName.length > 140) {
    throw new HttpError(400, "Repository must be written as owner/name");
  }
  return fullName;
}

function parseDisabledRules(value) {
  const valid =
    Array.isArray(value) &&
    value.length <= MAX_DISABLED_RULES &&
    value.every((item) => typeof item === "string" && RULE_ID.test(item));
  if (!valid) throw new HttpError(400, "disabledRules must be a list of rule ids");
  return [...new Set(value)];
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  normalizeEmail,
  validatePassword,
  normalizeName,
  parseFullName,
  parseDisabledRules,
  escapeRegex,
};

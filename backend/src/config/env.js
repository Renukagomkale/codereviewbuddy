require("dotenv").config();
const fs = require("fs");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function jwtSecret() {
  const secret = required("JWT_SECRET");
  if (secret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters long");
  return secret;
}

function privateKey() {
  if (process.env.GITHUB_APP_PRIVATE_KEY_PATH) {
    return fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, "utf8");
  }
  return required("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
}

const appId = process.env.GITHUB_APP_ID;

module.exports = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: required("MONGODB_URI"),
  webhookSecret: required("GITHUB_WEBHOOK_SECRET"),
  githubApp: appId ? { appId, privateKey: privateKey() } : null,
  githubToken: appId ? null : required("GITHUB_TOKEN"),
  analyzerUrl: process.env.ANALYZER_URL || "http://localhost:8000",
  jwtSecret: jwtSecret(),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
};

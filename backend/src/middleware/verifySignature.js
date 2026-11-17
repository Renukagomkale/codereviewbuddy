const crypto = require("crypto");
const HttpError = require("../utils/httpError");

function isValidSignature(rawBody, signatureHeader, secret) {
  if (!Buffer.isBuffer(rawBody) || typeof signatureHeader !== "string") return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expected = Buffer.from(`sha256=${digest}`);
  const received = Buffer.from(signatureHeader);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function verifySignature(secret) {
  return (req, res, next) => {
    if (isValidSignature(req.body, req.headers["x-hub-signature-256"], secret)) return next();
    next(new HttpError(401, "Invalid webhook signature"));
  };
}

module.exports = { isValidSignature, verifySignature };

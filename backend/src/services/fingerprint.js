const crypto = require("crypto");

function fingerprintOf({ ruleId, path }, lineText) {
  return crypto
    .createHash("sha1")
    .update([ruleId, path, lineText.trim()].join("\0"))
    .digest("hex")
    .slice(0, 16);
}

module.exports = { fingerprintOf };

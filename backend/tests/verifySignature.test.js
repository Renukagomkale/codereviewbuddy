const crypto = require("crypto");
const { isValidSignature, verifySignature } = require("../src/middleware/verifySignature");

const SECRET = "It's a Secret to Everybody";
const BODY = Buffer.from("Hello, World!");
const GITHUB_DOCS_SIGNATURE =
  "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17";

function sign(body, secret) {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("isValidSignature", () => {
  test("accepts the example signature from the GitHub documentation", () => {
    expect(isValidSignature(BODY, GITHUB_DOCS_SIGNATURE, SECRET)).toBe(true);
  });

  test("accepts a signature computed with the same secret", () => {
    expect(isValidSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true);
  });

  test("rejects a signature made with a different secret", () => {
    expect(isValidSignature(BODY, sign(BODY, "other-secret"), SECRET)).toBe(false);
  });

  test("rejects a body that was changed after signing", () => {
    const signature = sign(BODY, SECRET);
    expect(isValidSignature(Buffer.from("Hello, World?"), signature, SECRET)).toBe(false);
  });

  test("rejects a missing header", () => {
    expect(isValidSignature(BODY, undefined, SECRET)).toBe(false);
  });

  test("rejects a header without the sha256 prefix", () => {
    const bare = sign(BODY, SECRET).replace("sha256=", "");
    expect(isValidSignature(BODY, bare, SECRET)).toBe(false);
  });

  test("rejects the old sha1 scheme", () => {
    expect(isValidSignature(BODY, "sha1=" + "a".repeat(40), SECRET)).toBe(false);
  });

  test("rejects a header of the wrong length without throwing", () => {
    expect(isValidSignature(BODY, "sha256=abc", SECRET)).toBe(false);
    expect(isValidSignature(BODY, "", SECRET)).toBe(false);
  });

  test("rejects a body that is not a raw buffer", () => {
    expect(isValidSignature({}, sign(BODY, SECRET), SECRET)).toBe(false);
    expect(isValidSignature("Hello, World!", sign(BODY, SECRET), SECRET)).toBe(false);
  });
});

describe("verifySignature middleware", () => {
  function run(body, signature) {
    const calls = [];
    const req = { body, headers: { "x-hub-signature-256": signature } };
    verifySignature(SECRET)(req, {}, (...args) => calls.push(args));
    return calls;
  }

  test("continues without an error when the signature is valid", () => {
    expect(run(BODY, GITHUB_DOCS_SIGNATURE)).toEqual([[]]);
  });

  test("passes a 401 error on when the signature is invalid", () => {
    const calls = run(BODY, "sha256=" + "0".repeat(64));
    expect(calls).toHaveLength(1);
    expect(calls[0][0].status).toBe(401);
  });

  test("passes a 401 error on when the header is missing", () => {
    const calls = run(BODY, undefined);
    expect(calls[0][0].status).toBe(401);
  });
});

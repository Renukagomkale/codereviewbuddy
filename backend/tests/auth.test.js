const { createAuthHandlers } = require("../src/routes/auth");
const { requireAuth } = require("../src/middleware/requireAuth");
const { createTokenService } = require("../src/services/tokens");
const { hashPassword, verifyPassword } = require("../src/services/passwords");
const { createFakeModel, createRes, failureOf } = require("./fakes");

const SECRET = "s".repeat(40);

function setup(users = []) {
  const User = createFakeModel(users, { unique: ["email"] });
  const tokens = createTokenService(SECRET);
  const handlers = createAuthHandlers({ User, hashPassword, verifyPassword, tokens });
  return { User, tokens, handlers };
}

async function registered(handlers, body = { email: "renuka@example.com", password: "long-enough-1", name: "Renuka" }) {
  const res = createRes();
  await handlers.register({ body }, res);
  return res;
}

describe("register", () => {
  test("creates an account and returns a token with a safe user object", async () => {
    const { User, tokens, handlers } = setup();
    const res = await registered(handlers);
    expect(res.statusCode).toBe(201);
    expect(res.body.user).toEqual({ id: User.docs[0]._id, email: "renuka@example.com", name: "Renuka" });
    expect(tokens.verify(res.body.token)).toBe(User.docs[0]._id);
    expect(JSON.stringify(res.body).includes("passwordHash")).toBe(false);
  });

  test("stores a hash, never the password", async () => {
    const { User, handlers } = setup();
    await registered(handlers);
    expect(User.docs[0].passwordHash === "long-enough-1").toBe(false);
    expect(await verifyPassword("long-enough-1", User.docs[0].passwordHash)).toBe(true);
  });

  test("lowercases the email", async () => {
    const { User, handlers } = setup();
    await registered(handlers, { email: "Renuka@Example.COM", password: "long-enough-1" });
    expect(User.docs[0].email).toBe("renuka@example.com");
  });

  test("rejects a duplicate email with 409", async () => {
    const { handlers } = setup();
    await registered(handlers);
    const error = await failureOf(registered(handlers, { email: "RENUKA@example.com", password: "another-pass-1" }));
    expect(error.status).toBe(409);
  });

  test("rejects invalid input with 400 and creates nothing", async () => {
    const { User, handlers } = setup();
    const bodies = [
      undefined,
      {},
      { email: "nope", password: "long-enough-1" },
      { email: "a@b.com", password: "short" },
      { email: "a@b.com", password: { $ne: "" } },
      { email: { $gt: "" }, password: "long-enough-1" },
    ];
    for (const body of bodies) {
      const error = await failureOf(handlers.register({ body }, createRes()));
      expect(error.status).toBe(400);
    }
    expect(User.docs).toHaveLength(0);
  });
});

describe("login", () => {
  test("returns a token for the right credentials", async () => {
    const { User, tokens, handlers } = setup();
    await registered(handlers);
    const res = createRes();
    await handlers.login({ body: { email: "Renuka@example.com", password: "long-enough-1" } }, res);
    expect(res.statusCode).toBe(200);
    expect(tokens.verify(res.body.token)).toBe(User.docs[0]._id);
  });

  test("gives the same 401 for a wrong password and an unknown email", async () => {
    const { handlers } = setup();
    await registered(handlers);
    const wrongPassword = await failureOf(
      handlers.login({ body: { email: "renuka@example.com", password: "wrong-password" } }, createRes())
    );
    const unknownEmail = await failureOf(
      handlers.login({ body: { email: "ghost@example.com", password: "long-enough-1" } }, createRes())
    );
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.message).toBe(unknownEmail.message);
  });

  test("rejects a password that is not a string", async () => {
    const { handlers } = setup();
    await registered(handlers);
    const error = await failureOf(
      handlers.login({ body: { email: "renuka@example.com", password: { $ne: "" } } }, createRes())
    );
    expect(error.status).toBe(400);
  });
});

describe("me", () => {
  test("returns the signed-in user", async () => {
    const { User, handlers } = setup();
    await registered(handlers);
    const res = createRes();
    await handlers.me({ userId: User.docs[0]._id }, res);
    expect(res.body.user.email).toBe("renuka@example.com");
  });

  test("returns 401 when the account no longer exists", async () => {
    const { handlers } = setup();
    const error = await failureOf(handlers.me({ userId: "0".repeat(24) }, createRes()));
    expect(error.status).toBe(401);
  });
});

describe("requireAuth", () => {
  const tokens = createTokenService(SECRET);

  function run(authorization) {
    const calls = [];
    const req = { headers: authorization === undefined ? {} : { authorization } };
    requireAuth(tokens)(req, {}, (...args) => calls.push(args));
    return { req, calls };
  }

  test("sets the user id for a valid bearer token", () => {
    const { req, calls } = run(`Bearer ${tokens.sign("abc")}`);
    expect(calls).toEqual([[]]);
    expect(req.userId).toBe("abc");
  });

  test("answers 401 when the header is missing or not a bearer token", () => {
    for (const header of [undefined, "", "Bearer", `Basic ${tokens.sign("abc")}`, tokens.sign("abc")]) {
      expect(run(header).calls[0][0].status).toBe(401);
    }
  });

  test("answers 401 for a garbage, foreign or expired token", () => {
    const foreign = createTokenService("x".repeat(40)).sign("abc");
    const expired = createTokenService(SECRET, -10).sign("abc");
    for (const token of ["not.a.token", foreign, expired]) {
      expect(run(`Bearer ${token}`).calls[0][0].status).toBe(401);
    }
  });

  test("rejects a token that claims no signature algorithm", () => {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: "abc" })}.`;
    expect(run(`Bearer ${unsigned}`).calls[0][0].status).toBe(401);
  });
});

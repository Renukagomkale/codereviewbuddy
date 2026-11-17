const { hashPassword, verifyPassword } = require("../src/services/passwords");

describe("passwords", () => {
  test("a password verifies against its own hash", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
  });

  test("a different password does not verify", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("wrong horse battery", hash)).toBe(false);
  });

  test("the hash is not the password and is salted", async () => {
    const first = await hashPassword("correct horse battery");
    const second = await hashPassword("correct horse battery");
    expect(first === "correct horse battery").toBe(false);
    expect(first === second).toBe(false);
  });

  test("a missing hash never verifies", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", undefined)).toBe(false);
  });
});

const { fingerprintOf } = require("../src/services/fingerprint");

const finding = { ruleId: "print-call", path: "app.py", line: 3 };

describe("fingerprintOf", () => {
  test("returns 16 hex characters", () => {
    expect(fingerprintOf(finding, "print('x')")).toMatch(/^[a-f0-9]{16}$/);
  });

  test("is stable for the same input", () => {
    expect(fingerprintOf(finding, "print('x')")).toBe(fingerprintOf(finding, "print('x')"));
  });

  test("does not depend on the line number", () => {
    const moved = { ...finding, line: 120 };
    expect(fingerprintOf(moved, "print('x')")).toBe(fingerprintOf(finding, "print('x')"));
  });

  test("ignores whitespace around the line text", () => {
    expect(fingerprintOf(finding, "    print('x')  ")).toBe(fingerprintOf(finding, "print('x')"));
  });

  test("differs when the rule, file or text differs", () => {
    const base = fingerprintOf(finding, "print('x')");
    expect(fingerprintOf({ ...finding, ruleId: "bare-except" }, "print('x')") === base).toBe(false);
    expect(fingerprintOf({ ...finding, path: "other.py" }, "print('x')") === base).toBe(false);
    expect(fingerprintOf(finding, "print('y')") === base).toBe(false);
  });
});

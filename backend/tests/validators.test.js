const {
  normalizeEmail,
  validatePassword,
  normalizeName,
  parseFullName,
  parseDisabledRules,
  escapeRegex,
} = require("../src/utils/validators");

function statusOf(fn) {
  try {
    fn();
  } catch (error) {
    return error.status;
  }
  return null;
}

describe("normalizeEmail", () => {
  test("trims and lowercases", () => {
    expect(normalizeEmail("  Renuka@Example.COM ")).toBe("renuka@example.com");
  });

  test("rejects malformed addresses and non-strings with 400", () => {
    for (const bad of ["", "plain", "a@b", "a b@c.com", undefined, null, 5, { $gt: "" }, ["a@b.com"]]) {
      expect(statusOf(() => normalizeEmail(bad))).toBe(400);
    }
  });
});

describe("validatePassword", () => {
  test("accepts 8 to 72 characters", () => {
    expect(validatePassword("12345678")).toBe("12345678");
    expect(validatePassword("a".repeat(72))).toBe("a".repeat(72));
  });

  test("rejects short, long and non-string passwords with 400", () => {
    for (const bad of ["1234567", "a".repeat(73), undefined, 12345678, { $ne: "" }]) {
      expect(statusOf(() => validatePassword(bad))).toBe(400);
    }
  });
});

describe("normalizeName", () => {
  test("defaults to an empty name and trims", () => {
    expect(normalizeName(undefined)).toBe("");
    expect(normalizeName("  Renuka ")).toBe("Renuka");
  });

  test("rejects non-strings and very long names", () => {
    expect(statusOf(() => normalizeName(5))).toBe(400);
    expect(statusOf(() => normalizeName("a".repeat(81)))).toBe(400);
  });
});

describe("parseFullName", () => {
  test("accepts owner/name", () => {
    expect(parseFullName(" octo/demo-app.v2 ")).toBe("octo/demo-app.v2");
  });

  test("rejects anything else with 400", () => {
    for (const bad of ["octo", "octo/", "/demo", "a/b/c", "oc to/demo", "octo/de$mo", undefined, { a: 1 }]) {
      expect(statusOf(() => parseFullName(bad))).toBe(400);
    }
  });
});

describe("parseDisabledRules", () => {
  test("accepts a list of rule ids and removes duplicates", () => {
    expect(parseDisabledRules(["print-call", "todo-comment", "print-call"])).toEqual([
      "print-call",
      "todo-comment",
    ]);
    expect(parseDisabledRules([])).toEqual([]);
  });

  test("rejects non-lists, bad ids and oversized lists with 400", () => {
    const tooMany = Array.from({ length: 51 }, (_, index) => `rule-${index}`);
    for (const bad of [undefined, "print-call", [5], ["Bad Id"], [{ $ne: 1 }], ["a".repeat(51)], tooMany]) {
      expect(statusOf(() => parseDisabledRules(bad))).toBe(400);
    }
  });
});

describe("escapeRegex", () => {
  test("escapes characters that have a meaning in a pattern", () => {
    expect(escapeRegex("a.b")).toBe("a\\.b");
    expect(new RegExp(`^${escapeRegex("octo/demo.app")}$`).test("octo/demoXapp")).toBe(false);
  });
});

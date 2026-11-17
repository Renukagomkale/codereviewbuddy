const { parsePagination, parseDays, paginated } = require("../src/utils/query");

function statusOf(fn) {
  try {
    fn();
  } catch (error) {
    return error.status;
  }
  return null;
}

describe("parsePagination", () => {
  test("defaults to the first page of 20", () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  test("calculates how many documents to skip", () => {
    expect(parsePagination({ page: "3", limit: "10" })).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  test("rejects values that are not positive integers", () => {
    for (const bad of ["0", "-1", "1.5", "abc", "", ["1"], { $gt: "1" }]) {
      expect(statusOf(() => parsePagination({ page: bad }))).toBe(400);
    }
  });

  test("rejects a limit above 100", () => {
    expect(statusOf(() => parsePagination({ limit: "101" }))).toBe(400);
    expect(parsePagination({ limit: "100" }).limit).toBe(100);
  });
});

describe("parseDays", () => {
  test("defaults to 30 and accepts 1 to 365", () => {
    expect(parseDays(undefined)).toBe(30);
    expect(parseDays("1")).toBe(1);
    expect(parseDays("365")).toBe(365);
  });

  test("rejects zero, 366 and text", () => {
    for (const bad of ["0", "366", "week"]) {
      expect(statusOf(() => parseDays(bad))).toBe(400);
    }
  });
});

describe("paginated", () => {
  test("wraps items with paging details", () => {
    expect(paginated(["a", "b"], 45, { page: 2, limit: 20 })).toEqual({
      items: ["a", "b"],
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
  });

  test("reports zero pages for an empty list", () => {
    expect(paginated([], 0, { page: 1, limit: 20 }).totalPages).toBe(0);
  });
});

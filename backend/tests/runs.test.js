const { createRunHandlers } = require("../src/routes/runs");
const { oid, createFakeModel, createRes, failureOf } = require("./fakes");

const ALICE = oid(1);
const BOB = oid(2);
const API = oid(11);
const WEB = oid(12);
const BOB_REPO = oid(13);

function run(number, repo, createdAt) {
  return {
    _id: oid(100 + number),
    repo,
    prNumber: number,
    headSha: "abc",
    status: "done",
    findingsCount: number,
    durationMs: 1000,
    createdAt: new Date(createdAt),
  };
}

function setup() {
  const Repo = createFakeModel([
    { _id: API, fullName: "alice/api", user: ALICE },
    { _id: WEB, fullName: "alice/web", user: ALICE },
    { _id: BOB_REPO, fullName: "bob/tool", user: BOB },
  ]);
  const ReviewRun = createFakeModel([
    run(1, API, "2026-11-01"),
    run(2, WEB, "2026-11-02"),
    run(3, API, "2026-11-03"),
    run(4, BOB_REPO, "2026-11-04"),
  ]);
  const Finding = createFakeModel([
    { _id: oid(201), run: oid(101), path: "b.py", line: 5, ruleId: "print-call", severity: "low", message: "m", posted: true },
    { _id: oid(202), run: oid(101), path: "a.py", line: 9, ruleId: "mutable-default", severity: "high", message: "m", posted: true },
    { _id: oid(203), run: oid(101), path: "a.py", line: 2, ruleId: "bare-except", severity: "medium", message: "m", posted: true },
    { _id: oid(204), run: oid(104), path: "x.py", line: 1, ruleId: "print-call", severity: "low", message: "m", posted: true },
  ]);
  return { handlers: createRunHandlers({ Repo, ReviewRun, Finding }) };
}

describe("list", () => {
  test("returns runs from the caller's repositories, newest first", async () => {
    const { handlers } = setup();
    const res = createRes();
    await handlers.list({ userId: ALICE, query: {} }, res);
    expect(res.body.items.map((item) => item.prNumber)).toEqual([3, 2, 1]);
    expect(res.body.total).toBe(3);
  });

  test("never includes another user's runs", async () => {
    const { handlers } = setup();
    const res = createRes();
    await handlers.list({ userId: BOB, query: {} }, res);
    expect(res.body.items.map((item) => item.prNumber)).toEqual([4]);
  });

  test("names the repository on each run", async () => {
    const { handlers } = setup();
    const res = createRes();
    await handlers.list({ userId: ALICE, query: {} }, res);
    expect(res.body.items[0]).toEqual({
      id: oid(103),
      repoId: API,
      repoFullName: "alice/api",
      prNumber: 3,
      headSha: "abc",
      status: "done",
      findingsCount: 3,
      durationMs: 1000,
      error: null,
      createdAt: new Date("2026-11-03"),
    });
  });

  test("can be limited to one of the caller's repositories", async () => {
    const { handlers } = setup();
    const res = createRes();
    await handlers.list({ userId: ALICE, query: { repo: WEB } }, res);
    expect(res.body.items.map((item) => item.prNumber)).toEqual([2]);
  });

  test("answers 404 when the repository filter points at someone else's repository", async () => {
    const { handlers } = setup();
    const error = await failureOf(handlers.list({ userId: ALICE, query: { repo: BOB_REPO } }, createRes()));
    expect(error.status).toBe(404);
  });

  test("answers 404 when the repository filter is not an id", async () => {
    const { handlers } = setup();
    for (const repo of ["x", { $ne: "" }, [API]]) {
      const error = await failureOf(handlers.list({ userId: ALICE, query: { repo } }, createRes()));
      expect(error.status).toBe(404);
    }
  });

  test("pages through the results", async () => {
    const { handlers } = setup();
    const res = createRes();
    await handlers.list({ userId: ALICE, query: { page: "2", limit: "2" } }, res);
    expect(res.body.items.map((item) => item.prNumber)).toEqual([1]);
    expect(res.body.totalPages).toBe(2);
  });

  test("returns an empty page for a user without repositories", async () => {
    const { handlers } = setup();
    const res = createRes();
    await handlers.list({ userId: oid(77), query: {} }, res);
    expect(res.body).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
  });
});

describe("get", () => {
  test("returns the run with its findings, most severe first", async () => {
    const { handlers } = setup();
    const res = createRes();
    await handlers.get({ userId: ALICE, params: { id: oid(101) } }, res);
    expect(res.body.run.repoFullName).toBe("alice/api");
    expect(res.body.findings.map((finding) => finding.ruleId)).toEqual(["mutable-default", "bare-except", "print-call"]);
  });

  test("answers 404 for a run in someone else's repository", async () => {
    const { handlers } = setup();
    const error = await failureOf(handlers.get({ userId: ALICE, params: { id: oid(104) } }, createRes()));
    expect(error.status).toBe(404);
  });

  test("answers 404 for unknown and invalid ids", async () => {
    const { handlers } = setup();
    for (const id of [oid(999), "nope"]) {
      const error = await failureOf(handlers.get({ userId: ALICE, params: { id } }, createRes()));
      expect(error.status).toBe(404);
    }
  });
});

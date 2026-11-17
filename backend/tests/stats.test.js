const { createStatsHandlers } = require("../src/routes/stats");
const { oid, createFakeModel, createRes, failureOf } = require("./fakes");

const ALICE = oid(1);
const BOB = oid(2);
const API = oid(11);
const BOB_REPO = oid(13);
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days) {
  return new Date(Date.now() - days * DAY_MS);
}

function setup({ findingRows = [], runRows = [] } = {}) {
  const Repo = createFakeModel([
    { _id: API, fullName: "alice/api", user: ALICE },
    { _id: BOB_REPO, fullName: "bob/tool", user: BOB },
  ]);
  const ReviewRun = createFakeModel(
    [
      { _id: oid(101), repo: API, createdAt: daysAgo(2) },
      { _id: oid(102), repo: API, createdAt: daysAgo(40) },
      { _id: oid(103), repo: BOB_REPO, createdAt: daysAgo(1) },
    ],
    { aggregateResult: runRows }
  );
  const Finding = createFakeModel([], { aggregateResult: findingRows });
  return { ReviewRun, Finding, handlers: createStatsHandlers({ Repo, ReviewRun, Finding }) };
}

function matchedRunIds(Finding) {
  return Finding.aggregateCalls[0][0].$match.run.$in;
}

describe("rules", () => {
  test("counts findings per rule, most frequent first", async () => {
    const rows = [
      { _id: "print-call", severity: "low", count: 7 },
      { _id: "bare-except", severity: "medium", count: 2 },
    ];
    const { handlers } = setup({ findingRows: rows });
    const res = createRes();
    await handlers.rules({ userId: ALICE, query: {} }, res);
    expect(res.body).toEqual({
      days: 30,
      rules: [
        { ruleId: "print-call", severity: "low", count: 7 },
        { ruleId: "bare-except", severity: "medium", count: 2 },
      ],
    });
  });

  test("only looks at the caller's runs inside the time window", async () => {
    const { Finding, handlers } = setup({ findingRows: [{ _id: "print-call", severity: "low", count: 1 }] });
    await handlers.rules({ userId: ALICE, query: {} }, createRes());
    expect(matchedRunIds(Finding)).toEqual([oid(101)]);
  });

  test("widens the window with the days parameter", async () => {
    const { Finding, handlers } = setup({ findingRows: [{ _id: "print-call", severity: "low", count: 1 }] });
    const res = createRes();
    await handlers.rules({ userId: ALICE, query: { days: "90" } }, res);
    expect(res.body.days).toBe(90);
    expect(matchedRunIds(Finding)).toEqual([oid(101), oid(102)]);
  });

  test("does not touch the findings when there are no runs", async () => {
    const { Finding, handlers } = setup();
    const res = createRes();
    await handlers.rules({ userId: oid(77), query: {} }, res);
    expect(res.body.rules).toEqual([]);
    expect(Finding.aggregateCalls).toHaveLength(0);
  });

  test("answers 404 when asked about someone else's repository", async () => {
    const { handlers } = setup();
    const error = await failureOf(handlers.rules({ userId: ALICE, query: { repo: BOB_REPO } }, createRes()));
    expect(error.status).toBe(404);
  });

  test("rejects a bad days value", async () => {
    const { handlers } = setup();
    for (const days of ["0", "400", "abc"]) {
      const error = await failureOf(handlers.rules({ userId: ALICE, query: { days } }, createRes()));
      expect(error.status).toBe(400);
    }
  });
});

describe("summary", () => {
  test("reports totals for the window with a rounded average duration", async () => {
    const row = { _id: null, runs: 12, findings: 40, failed: 1, avgDurationMs: 3456.78 };
    const { handlers } = setup({ runRows: [row] });
    const res = createRes();
    await handlers.summary({ userId: ALICE, query: {} }, res);
    expect(res.body).toEqual({ days: 30, runs: 12, findings: 40, failed: 1, avgDurationMs: 3457 });
  });

  test("reports zeros when nothing has run", async () => {
    const { handlers } = setup({ runRows: [] });
    const res = createRes();
    await handlers.summary({ userId: ALICE, query: {} }, res);
    expect(res.body).toEqual({ days: 30, runs: 0, findings: 0, failed: 0, avgDurationMs: null });
  });

  test("keeps a missing average as null", async () => {
    const row = { _id: null, runs: 1, findings: 0, failed: 1, avgDurationMs: null };
    const { handlers } = setup({ runRows: [row] });
    const res = createRes();
    await handlers.summary({ userId: ALICE, query: {} }, res);
    expect(res.body.avgDurationMs).toBe(null);
  });

  test("only matches the caller's repositories", async () => {
    const { ReviewRun, handlers } = setup();
    await handlers.summary({ userId: ALICE, query: {} }, createRes());
    expect(ReviewRun.aggregateCalls[0][0].$match.repo.$in).toEqual([API]);
  });

  test("answers 404 when asked about someone else's repository", async () => {
    const { handlers } = setup();
    const error = await failureOf(handlers.summary({ userId: ALICE, query: { repo: BOB_REPO } }, createRes()));
    expect(error.status).toBe(404);
  });
});

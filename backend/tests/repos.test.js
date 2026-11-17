const { createRepoHandlers } = require("../src/routes/repos");
const { oid, createFakeModel, createRes, failureOf } = require("./fakes");

const ALICE = oid(1);
const BOB = oid(2);

function setup() {
  const Repo = createFakeModel([
    { _id: oid(11), fullName: "alice/api", owner: "alice", name: "api", user: ALICE, disabledRules: [] },
    { _id: oid(12), fullName: "alice/web", owner: "alice", name: "web", user: ALICE, disabledRules: ["print-call"] },
    { _id: oid(13), fullName: "bob/tool", owner: "bob", name: "tool", user: BOB, disabledRules: [] },
    { _id: oid(14), fullName: "Octo/Unclaimed", owner: "Octo", name: "Unclaimed", user: null, disabledRules: [] },
  ]);
  return { Repo, handlers: createRepoHandlers({ Repo }) };
}

describe("list", () => {
  test("returns only the caller's repositories", async () => {
    const { handlers } = setup();
    const res = createRes();
    await handlers.list({ userId: ALICE, query: {} }, res);
    expect(res.body.items.map((repo) => repo.fullName)).toEqual(["alice/api", "alice/web"]);
    expect(res.body.total).toBe(2);
  });

  test("never shows another user's or unclaimed repositories", async () => {
    const { handlers } = setup();
    const res = createRes();
    await handlers.list({ userId: BOB, query: {} }, res);
    expect(res.body.items.map((repo) => repo.fullName)).toEqual(["bob/tool"]);
  });

  test("pages through the results", async () => {
    const { handlers } = setup();
    const res = createRes();
    await handlers.list({ userId: ALICE, query: { page: "2", limit: "1" } }, res);
    expect(res.body.items.map((repo) => repo.fullName)).toEqual(["alice/web"]);
    expect(res.body.totalPages).toBe(2);
  });

  test("shapes each repository for the client", async () => {
    const { handlers } = setup();
    const res = createRes();
    await handlers.list({ userId: ALICE, query: {} }, res);
    expect(res.body.items[1]).toEqual({
      id: oid(12),
      fullName: "alice/web",
      owner: "alice",
      name: "web",
      disabledRules: ["print-call"],
    });
  });

  test("rejects a bad page number", async () => {
    const { handlers } = setup();
    const error = await failureOf(handlers.list({ userId: ALICE, query: { page: "0" } }, createRes()));
    expect(error.status).toBe(400);
  });
});

describe("claim", () => {
  test("connects an unclaimed repository to the caller", async () => {
    const { Repo, handlers } = setup();
    const res = createRes();
    await handlers.claim({ userId: ALICE, body: { fullName: "Octo/Unclaimed" } }, res);
    expect(res.body.repo.fullName).toBe("Octo/Unclaimed");
    expect(Repo.docs[3].user).toBe(ALICE);
  });

  test("ignores letter case in the name", async () => {
    const { Repo, handlers } = setup();
    await handlers.claim({ userId: ALICE, body: { fullName: "octo/unclaimed" } }, createRes());
    expect(Repo.docs[3].user).toBe(ALICE);
  });

  test("is harmless when the caller already owns the repository", async () => {
    const { handlers } = setup();
    const res = createRes();
    await handlers.claim({ userId: ALICE, body: { fullName: "alice/api" } }, res);
    expect(res.body.repo.id).toBe(oid(11));
  });

  test("refuses a repository that belongs to someone else with 409", async () => {
    const { Repo, handlers } = setup();
    const error = await failureOf(handlers.claim({ userId: ALICE, body: { fullName: "bob/tool" } }, createRes()));
    expect(error.status).toBe(409);
    expect(Repo.docs[2].user).toBe(BOB);
  });

  test("answers 404 when the bot has never seen the repository", async () => {
    const { handlers } = setup();
    const error = await failureOf(handlers.claim({ userId: ALICE, body: { fullName: "ghost/repo" } }, createRes()));
    expect(error.status).toBe(404);
  });

  test("treats dots in the name literally", async () => {
    const { handlers } = setup();
    const error = await failureOf(handlers.claim({ userId: ALICE, body: { fullName: "Octo/Unclaime." } }, createRes()));
    expect(error.status).toBe(404);
  });

  test("rejects a malformed name with 400", async () => {
    const { handlers } = setup();
    for (const body of [undefined, {}, { fullName: "no-slash" }, { fullName: { $ne: "" } }]) {
      const error = await failureOf(handlers.claim({ userId: ALICE, body }, createRes()));
      expect(error.status).toBe(400);
    }
  });
});

describe("updateSettings", () => {
  test("saves the disabled rules of an owned repository", async () => {
    const { Repo, handlers } = setup();
    const res = createRes();
    await handlers.updateSettings(
      { userId: ALICE, params: { id: oid(11) }, body: { disabledRules: ["todo-comment", "print-call", "todo-comment"] } },
      res
    );
    expect(res.body.repo.disabledRules).toEqual(["todo-comment", "print-call"]);
    expect(Repo.docs[0].disabledRules).toEqual(["todo-comment", "print-call"]);
  });

  test("answers 404 and changes nothing for someone else's repository", async () => {
    const { Repo, handlers } = setup();
    const error = await failureOf(
      handlers.updateSettings({ userId: ALICE, params: { id: oid(13) }, body: { disabledRules: ["print-call"] } }, createRes())
    );
    expect(error.status).toBe(404);
    expect(Repo.docs[2].disabledRules).toEqual([]);
  });

  test("answers 404 for an unclaimed repository and for ids that are not valid", async () => {
    const { handlers } = setup();
    for (const id of [oid(14), "not-an-id", oid(999)]) {
      const error = await failureOf(
        handlers.updateSettings({ userId: ALICE, params: { id }, body: { disabledRules: [] } }, createRes())
      );
      expect(error.status).toBe(404);
    }
  });

  test("rejects a bad rule list with 400", async () => {
    const { handlers } = setup();
    for (const body of [undefined, {}, { disabledRules: "print-call" }, { disabledRules: [1] }]) {
      const error = await failureOf(handlers.updateSettings({ userId: ALICE, params: { id: oid(11) }, body }, createRes()));
      expect(error.status).toBe(400);
    }
  });
});

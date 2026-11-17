const { createWebhookHandler } = require("../src/routes/webhook");

function createFakes(options = {}) {
  const state = { repos: [], runs: [], queued: [] };

  const Repo = {
    async findOneAndUpdate(filter, update) {
      let repo = state.repos.find((item) => item.fullName === filter.fullName);
      if (!repo) {
        repo = { _id: `repo-${state.repos.length + 1}`, ...filter, ...update.$setOnInsert };
        state.repos.push(repo);
      }
      Object.assign(repo, update.$set);
      return repo;
    },
  };

  const ReviewRun = {
    async create(data) {
      if (options.createError) throw options.createError;
      if (state.runs.some((run) => run.deliveryId === data.deliveryId)) {
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      }
      const run = { _id: `run-${state.runs.length + 1}`, ...data };
      state.runs.push(run);
      return run;
    },
  };

  const enqueueReview = async (run) => {
    if (options.enqueueError) throw options.enqueueError;
    state.queued.push(run);
  };

  return { state, handler: createWebhookHandler({ Repo, ReviewRun, enqueueReview }) };
}

function pullRequestPayload(action = "opened", overrides = {}) {
  return {
    action,
    pull_request: { number: 7, head: { sha: "abc123" } },
    repository: { full_name: "octo/demo", name: "demo", owner: { login: "octo" } },
    ...overrides,
  };
}

function requestOf(event, payload, deliveryId = "delivery-1") {
  const headers = {};
  if (event) headers["x-github-event"] = event;
  if (deliveryId) headers["x-github-delivery"] = deliveryId;
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
  return { headers, body };
}

async function send(handler, req) {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  let error = null;
  await handler(req, res, (value) => {
    error = value;
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { res, error };
}

describe("webhook handler", () => {
  test("answers a ping without creating anything", async () => {
    const { state, handler } = createFakes();
    const { res } = await send(handler, requestOf("ping", { zen: "Keep it logically awesome." }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "pong" });
    expect(state.runs).toHaveLength(0);
  });

  test("ignores events that are not pull requests", async () => {
    const { state, handler } = createFakes();
    const { res } = await send(handler, requestOf("push", { ref: "refs/heads/main" }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "ignored" });
    expect(state.runs).toHaveLength(0);
  });

  test("ignores pull request actions that need no review", async () => {
    const { state, handler } = createFakes();
    for (const action of ["closed", "labeled", "edited", "assigned"]) {
      const { res } = await send(handler, requestOf("pull_request", pullRequestPayload(action), action));
      expect(res.body).toEqual({ status: "ignored" });
    }
    expect(state.runs).toHaveLength(0);
  });

  test("queues a review for opened, synchronize and reopened", async () => {
    const { state, handler } = createFakes();
    for (const action of ["opened", "synchronize", "reopened"]) {
      const { res } = await send(handler, requestOf("pull_request", pullRequestPayload(action), action));
      expect(res.statusCode).toBe(202);
      expect(res.body.status).toBe("queued");
    }
    expect(state.runs).toHaveLength(3);
  });

  test("stores the pull request details on the run", async () => {
    const { state, handler } = createFakes();
    const { res } = await send(handler, requestOf("pull_request", pullRequestPayload(), "delivery-9"));
    expect(res.body.runId).toBe("run-1");
    expect(state.runs[0]).toEqual({
      _id: "run-1",
      repo: "repo-1",
      prNumber: 7,
      headSha: "abc123",
      deliveryId: "delivery-9",
    });
  });

  test("hands the new run to the review job", async () => {
    const { state, handler } = createFakes();
    await send(handler, requestOf("pull_request", pullRequestPayload()));
    expect(state.queued).toEqual([state.runs[0]]);
  });

  test("creates the repo once and reuses it", async () => {
    const { state, handler } = createFakes();
    await send(handler, requestOf("pull_request", pullRequestPayload("opened"), "d1"));
    await send(handler, requestOf("pull_request", pullRequestPayload("synchronize"), "d2"));
    expect(state.repos).toHaveLength(1);
    expect(state.repos[0].owner).toBe("octo");
    expect(state.runs.map((run) => run.repo)).toEqual(["repo-1", "repo-1"]);
  });

  test("a redelivered event is acknowledged but not processed twice", async () => {
    const { state, handler } = createFakes();
    await send(handler, requestOf("pull_request", pullRequestPayload(), "same-delivery"));
    const { res } = await send(handler, requestOf("pull_request", pullRequestPayload(), "same-delivery"));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "duplicate" });
    expect(state.runs).toHaveLength(1);
    expect(state.queued).toHaveLength(1);
  });

  test("rejects a body that is not valid JSON", async () => {
    const { handler } = createFakes();
    const { error } = await send(handler, requestOf("pull_request", Buffer.from("{broken")));
    expect(error.status).toBe(400);
  });

  test("rejects a request without the GitHub headers", async () => {
    const { handler } = createFakes();
    const noEvent = await send(handler, requestOf(null, pullRequestPayload()));
    const noDelivery = await send(handler, requestOf("pull_request", pullRequestPayload(), null));
    expect(noEvent.error.status).toBe(400);
    expect(noDelivery.error.status).toBe(400);
  });

  test("rejects a pull request event without pull request data", async () => {
    const { handler } = createFakes();
    const { error } = await send(handler, requestOf("pull_request", { action: "opened" }));
    expect(error.status).toBe(400);
  });

  test("still answers 202 when starting the review fails", async () => {
    const { handler } = createFakes({ enqueueError: new Error("boom") });
    const originalConsoleError = console.error;
    console.error = () => {};
    const { res, error } = await send(handler, requestOf("pull_request", pullRequestPayload()));
    console.error = originalConsoleError;
    expect(res.statusCode).toBe(202);
    expect(error).toBe(null);
  });

  test("passes unexpected database errors on to the error handler", async () => {
    const failure = new Error("database is down");
    const { handler } = createFakes({ createError: failure });
    const { error } = await send(handler, requestOf("pull_request", pullRequestPayload()));
    expect(error).toBe(failure);
  });
});

describe("webhook handler and the GitHub App installation", () => {
  test("remembers the installation id from the payload", async () => {
    const { state, handler } = createFakes();
    await send(handler, requestOf("pull_request", pullRequestPayload("opened", { installation: { id: 4242 } })));
    expect(state.repos[0].installationId).toBe(4242);
  });

  test("updates the installation id when it changes", async () => {
    const { state, handler } = createFakes();
    await send(handler, requestOf("pull_request", pullRequestPayload("opened", { installation: { id: 1 } }), "d1"));
    await send(handler, requestOf("pull_request", pullRequestPayload("synchronize", { installation: { id: 2 } }), "d2"));
    expect(state.repos).toHaveLength(1);
    expect(state.repos[0].installationId).toBe(2);
  });

  test("works without an installation id", async () => {
    const { state, handler } = createFakes();
    await send(handler, requestOf("pull_request", pullRequestPayload()));
    expect(state.repos[0].installationId).toBe(undefined);
  });
});

const { createReviewJob, MAX_COMMENTS } = require("../src/jobs/reviewJob");
const { fingerprintOf } = require("../src/services/fingerprint");
const { formatComment } = require("../src/services/commentFormatter");

const PATCH = ["@@ -1,2 +1,4 @@", " import os", "+print('debug')", "+x = 1", " y = 2"].join("\n");
const PYTHON_FILE = { filename: "app.py", status: "modified", patch: PATCH };
const PRINT_FINDING = {
  path: "app.py",
  line: 2,
  ruleId: "print-call",
  severity: "low",
  message: "Leftover print call. Remove it or use logging.",
};
const SILENT = { log() {}, error() {} };

function setup({ files = [PYTHON_FILE], findings = [], existingComments = [], disabledRules = [], githubError } = {}) {
  const log = { updates: [], saved: [], reviews: [], contentRequests: [], analyzed: [] };

  const Repo = {
    async findById() {
      return { owner: "octo", name: "demo", disabledRules, installationId: 4242 };
    },
  };
  const ReviewRun = {
    async updateOne(filter, update) {
      log.updates.push(update);
    },
  };
  const Finding = {
    async insertMany(docs) {
      log.saved.push(...docs);
    },
  };
  const github = {
    async listPullRequestFiles() {
      if (githubError) throw githubError;
      return files;
    },
    async getFileContent({ path }) {
      log.contentRequests.push(path);
      return `content of ${path}`;
    },
    async listReviewComments() {
      return existingComments;
    },
    async createReview(review) {
      log.reviews.push(review);
    },
  };
  const analyze = async (analyzerFiles) => {
    log.analyzed.push(analyzerFiles);
    return findings;
  };

  const run = { _id: "run-1", repo: "repo-1", prNumber: 7, headSha: "abc123" };
  const enqueueReview = createReviewJob({ Repo, ReviewRun, Finding, github, analyze, logger: SILENT });
  return { log, run, enqueueReview };
}

function manyAddedLines(count) {
  const body = Array.from({ length: count }, (_, index) => `+value${index + 1} = ${index + 1}`);
  return [`@@ -0,0 +1,${count} @@`, ...body].join("\n");
}

function findingsOnLines(count) {
  return Array.from({ length: count }, (_, index) => ({ ...PRINT_FINDING, line: index + 1 }));
}

describe("review job", () => {
  test("posts one batched review with an inline comment per new finding", async () => {
    const { log, run, enqueueReview } = setup({ findings: [PRINT_FINDING] });
    await enqueueReview(run);

    expect(log.reviews).toHaveLength(1);
    const review = log.reviews[0];
    expect(review.owner).toBe("octo");
    expect(review.repo).toBe("demo");
    expect(review.pullNumber).toBe(7);
    expect(review.commitId).toBe("abc123");
    expect(review.body).toContain("Found 1 new issue");
    const fingerprint = fingerprintOf(PRINT_FINDING, "print('debug')");
    expect(review.comments).toEqual([
      {
        path: "app.py",
        line: 2,
        side: "RIGHT",
        body: formatComment({ ...PRINT_FINDING, fingerprint }),
      },
    ]);
  });

  test("sends the analyzer only the added lines, with real line numbers and the full file", async () => {
    const { log, run, enqueueReview } = setup();
    await enqueueReview(run);
    expect(log.analyzed).toEqual([
      [
        {
          path: "app.py",
          addedLines: [
            { line: 2, text: "print('debug')" },
            { line: 3, text: "x = 1" },
          ],
          content: "content of app.py",
        },
      ],
    ]);
  });

  test("leaves out removed files, files without a patch and ignored files", async () => {
    const files = [
      PYTHON_FILE,
      { filename: "old.py", status: "removed", patch: PATCH },
      { filename: "image.png", status: "added" },
      { filename: "package-lock.json", status: "modified", patch: PATCH },
    ];
    const { log, run, enqueueReview } = setup({ files });
    await enqueueReview(run);
    expect(log.contentRequests).toEqual(["app.py"]);
  });

  test("does not call the analyzer when no file has added lines", async () => {
    const deletionOnly = { filename: "app.py", status: "modified", patch: "@@ -1,2 +0,0 @@\n-a\n-b" };
    const { log, run, enqueueReview } = setup({ files: [deletionOnly] });
    await enqueueReview(run);
    expect(log.analyzed).toHaveLength(0);
    expect(log.reviews).toHaveLength(0);
    expect(log.updates[1].status).toBe("done");
  });

  test("posts nothing when the analyzer finds nothing", async () => {
    const { log, run, enqueueReview } = setup({ findings: [] });
    await enqueueReview(run);
    expect(log.reviews).toHaveLength(0);
    expect(log.saved).toHaveLength(0);
    expect(log.updates[1].findingsCount).toBe(0);
  });

  test("skips an issue the bot already commented on, even if its line moved", async () => {
    const earlier = { ruleId: "print-call", path: "app.py" };
    const marker = `<!-- crb:${fingerprintOf(earlier, "print('debug')")} -->`;
    const existingComments = [{ body: `Earlier comment\n\n${marker}` }];
    const { log, run, enqueueReview } = setup({ findings: [PRINT_FINDING], existingComments });
    await enqueueReview(run);
    expect(log.reviews).toHaveLength(0);
    expect(log.saved).toHaveLength(0);
  });

  test("still posts a new issue when only other issues were commented before", async () => {
    const other = { ruleId: "bare-except", path: "app.py" };
    const existingComments = [{ body: `<!-- crb:${fingerprintOf(other, "except:")} -->` }];
    const { log, run, enqueueReview } = setup({ findings: [PRINT_FINDING], existingComments });
    await enqueueReview(run);
    expect(log.reviews[0].comments).toHaveLength(1);
  });

  test("ignores rules the repository has switched off", async () => {
    const { log, run, enqueueReview } = setup({ findings: [PRINT_FINDING], disabledRules: ["print-call"] });
    await enqueueReview(run);
    expect(log.reviews).toHaveLength(0);
  });

  test("reports the same issue only once within a run", async () => {
    const { log, run, enqueueReview } = setup({ findings: [PRINT_FINDING, PRINT_FINDING] });
    await enqueueReview(run);
    expect(log.reviews[0].comments).toHaveLength(1);
    expect(log.saved).toHaveLength(1);
  });

  test("lists the most severe issues first", async () => {
    const high = { ...PRINT_FINDING, line: 3, ruleId: "hardcoded-secret", severity: "high", message: "Secret." };
    const { log, run, enqueueReview } = setup({ findings: [PRINT_FINDING, high] });
    await enqueueReview(run);
    const [first, second] = log.reviews[0].comments;
    expect(first.body).toContain("hardcoded-secret");
    expect(second.body).toContain("print-call");
  });

  test("saves each finding with its fingerprint and run", async () => {
    const { log, run, enqueueReview } = setup({ findings: [PRINT_FINDING] });
    await enqueueReview(run);
    expect(log.saved).toEqual([
      {
        run: "run-1",
        path: "app.py",
        line: 2,
        ruleId: "print-call",
        severity: "low",
        message: PRINT_FINDING.message,
        fingerprint: fingerprintOf(PRINT_FINDING, "print('debug')"),
        posted: true,
      },
    ]);
  });

  test("comments on at most 30 issues and keeps the rest for the next push", async () => {
    const total = MAX_COMMENTS + 5;
    const files = [{ filename: "app.py", status: "added", patch: manyAddedLines(total) }];
    const { log, run, enqueueReview } = setup({ files, findings: findingsOnLines(total) });
    await enqueueReview(run);

    expect(log.reviews[0].comments).toHaveLength(MAX_COMMENTS);
    expect(log.reviews[0].body).toContain("5 more issues not commented");
    expect(log.saved).toHaveLength(total);
    expect(log.saved.filter((finding) => finding.posted)).toHaveLength(MAX_COMMENTS);
    expect(log.updates[1].findingsCount).toBe(total);
  });

  test("only reviews the first 50 files of a very large pull request and says so", async () => {
    const files = Array.from({ length: 55 }, (_, index) => ({
      filename: `f${index}.py`,
      status: "added",
      patch: "@@ -0,0 +1 @@\n+x = 1",
    }));
    const finding = { ...PRINT_FINDING, path: "f0.py", line: 1 };
    const { log, run, enqueueReview } = setup({ files, findings: [finding] });
    await enqueueReview(run);
    expect(log.analyzed[0]).toHaveLength(50);
    expect(log.reviews[0].body).toContain("only part of the diff was reviewed");
  });

  test("moves the run from running to done and records its duration", async () => {
    const { log, run, enqueueReview } = setup({ findings: [PRINT_FINDING] });
    await enqueueReview(run);
    expect(log.updates[0]).toEqual({ status: "running" });
    expect(log.updates[1].status).toBe("done");
    expect(log.updates[1].findingsCount).toBe(1);
    expect(typeof log.updates[1].durationMs).toBe("number");
  });

  test("marks the run as failed with the reason when GitHub cannot be reached", async () => {
    const { log, run, enqueueReview } = setup({ githubError: new Error("GitHub is unreachable") });
    await enqueueReview(run);
    const last = log.updates[log.updates.length - 1];
    expect(last.status).toBe("failed");
    expect(last.error).toBe("GitHub is unreachable");
    expect(log.reviews).toHaveLength(0);
  });
});

describe("review job and the GitHub App", () => {
  test("uses the repository's installation for the GitHub calls", async () => {
    const { log, run, enqueueReview } = setup({ findings: [PRINT_FINDING] });
    await enqueueReview(run);
    expect(log.reviews[0].installationId).toBe(4242);
  });
});

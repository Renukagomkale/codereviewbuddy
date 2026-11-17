const { parsePatch } = require("../services/diffParser");
const { selectFiles } = require("../services/fileSelection");
const { fingerprintOf } = require("../services/fingerprint");
const { formatComment, formatSummary, extractFingerprints } = require("../services/commentFormatter");
const { compareBySeverity } = require("../services/severity");

const MAX_COMMENTS = 30;

function createReviewJob({ Repo, ReviewRun, Finding, github, analyze, logger = console }) {
  async function collectAnalyzerFiles(location, headSha, files) {
    const prepared = await Promise.all(
      files.map(async (file) => {
        const addedLines = parsePatch(file.patch);
        if (addedLines.length === 0) return null;
        const content = await github.getFileContent({ ...location, path: file.filename, ref: headSha });
        return { path: file.filename, addedLines, content };
      })
    );
    return prepared.filter(Boolean);
  }

  async function findNewIssues(location, run, analyzerFiles, disabledRules) {
    if (analyzerFiles.length === 0) return [];

    const lineText = new Map(
      analyzerFiles.flatMap((file) => file.addedLines.map((added) => [`${file.path}:${added.line}`, added.text]))
    );
    const findings = (await analyze(analyzerFiles))
      .filter((finding) => !disabledRules.includes(finding.ruleId))
      .map((finding) => ({
        ...finding,
        fingerprint: fingerprintOf(finding, lineText.get(`${finding.path}:${finding.line}`) || ""),
      }));
    if (findings.length === 0) return [];

    const comments = await github.listReviewComments({ ...location, pullNumber: run.prNumber });
    const seen = extractFingerprints(comments.map((comment) => comment.body));
    return findings
      .filter((finding) => {
        if (seen.has(finding.fingerprint)) return false;
        seen.add(finding.fingerprint);
        return true;
      })
      .sort(compareBySeverity);
  }

  async function reviewPullRequest(run) {
    const repo = await Repo.findById(run.repo);
    const location = { owner: repo.owner, repo: repo.name, installationId: repo.installationId };

    const pullFiles = await github.listPullRequestFiles({ ...location, pullNumber: run.prNumber });
    const { files, truncated } = selectFiles(pullFiles);
    const analyzerFiles = await collectAnalyzerFiles(location, run.headSha, files);
    const fresh = await findNewIssues(location, run, analyzerFiles, repo.disabledRules);
    if (fresh.length === 0) return 0;

    const toPost = fresh.slice(0, MAX_COMMENTS);
    await github.createReview({
      ...location,
      pullNumber: run.prNumber,
      commitId: run.headSha,
      body: formatSummary(fresh, { omitted: fresh.length - toPost.length, truncated }),
      comments: toPost.map((finding) => ({
        path: finding.path,
        line: finding.line,
        side: "RIGHT",
        body: formatComment(finding),
      })),
    });

    await Finding.insertMany(
      fresh.map((finding, index) => ({
        run: run._id,
        path: finding.path,
        line: finding.line,
        ruleId: finding.ruleId,
        severity: finding.severity,
        message: finding.message,
        fingerprint: finding.fingerprint,
        posted: index < MAX_COMMENTS,
      }))
    );
    return fresh.length;
  }

  return async function enqueueReview(run) {
    const startedAt = Date.now();
    try {
      await ReviewRun.updateOne({ _id: run._id }, { status: "running" });
      const findingsCount = await reviewPullRequest(run);
      await ReviewRun.updateOne(
        { _id: run._id },
        { status: "done", findingsCount, durationMs: Date.now() - startedAt }
      );
      logger.log(`Review done: PR #${run.prNumber}, ${findingsCount} new issue(s)`);
    } catch (error) {
      logger.error(`Review failed: PR #${run.prNumber}: ${error.message}`);
      await ReviewRun.updateOne(
        { _id: run._id },
        { status: "failed", error: error.message, durationMs: Date.now() - startedAt }
      );
    }
  };
}

module.exports = { createReviewJob, MAX_COMMENTS };

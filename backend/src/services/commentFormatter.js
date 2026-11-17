const SEVERITIES = ["high", "medium", "low"];
const SEVERITY_LABEL = {
  high: "🔴 **High**",
  medium: "🟠 **Medium**",
  low: "🟡 **Low**",
};

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function formatComment(finding) {
  return [
    `${SEVERITY_LABEL[finding.severity]} · \`${finding.ruleId}\``,
    "",
    finding.message,
    "",
    `<!-- crb:${finding.fingerprint} -->`,
  ].join("\n");
}

function formatSummary(findings, { omitted = 0, truncated = false } = {}) {
  const counts = SEVERITIES.map((severity) => [
    severity,
    findings.filter((finding) => finding.severity === severity).length,
  ])
    .filter(([, count]) => count > 0)
    .map(([severity, count]) => `${count} ${severity}`);

  const lines = [
    "### CodeReviewBuddy",
    "",
    `Found ${plural(findings.length, "new issue")} in the changed lines: ${counts.join(", ")}.`,
  ];
  if (omitted > 0) {
    lines.push(
      "",
      `${plural(omitted, "more issue")} not commented here to keep this review short. They will be reported on the next push if they are still present.`
    );
  }
  if (truncated) {
    lines.push("", "This pull request is large, so only part of the diff was reviewed.");
  }
  return lines.join("\n");
}

function extractFingerprints(commentBodies) {
  const fingerprints = new Set();
  for (const body of commentBodies) {
    for (const match of (body || "").matchAll(/<!-- crb:([a-f0-9]+) -->/g)) {
      fingerprints.add(match[1]);
    }
  }
  return fingerprints;
}

module.exports = { formatComment, formatSummary, extractFingerprints };

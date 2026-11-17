const { formatComment, formatSummary, extractFingerprints } = require("../src/services/commentFormatter");

const finding = {
  ruleId: "bare-except",
  severity: "medium",
  message: "Catch a specific exception instead.",
  fingerprint: "0123456789abcdef",
};

describe("formatComment", () => {
  test("shows the severity label, the rule id and the message", () => {
    const body = formatComment(finding);
    expect(body).toContain("Medium");
    expect(body).toContain("`bare-except`");
    expect(body).toContain("Catch a specific exception instead.");
  });

  test("embeds the fingerprint as a hidden marker", () => {
    expect(formatComment(finding)).toContain("<!-- crb:0123456789abcdef -->");
  });

  test("labels every severity with text", () => {
    expect(formatComment({ ...finding, severity: "high" })).toContain("High");
    expect(formatComment({ ...finding, severity: "low" })).toContain("Low");
  });
});

describe("extractFingerprints", () => {
  test("reads the marker back from a formatted comment", () => {
    expect(extractFingerprints([formatComment(finding)])).toEqual(new Set(["0123456789abcdef"]));
  });

  test("collects markers from many comments", () => {
    const other = { ...finding, fingerprint: "fedcba9876543210" };
    const found = extractFingerprints([formatComment(finding), "a human comment", formatComment(other)]);
    expect(found).toEqual(new Set(["0123456789abcdef", "fedcba9876543210"]));
  });

  test("ignores comments without a marker and missing bodies", () => {
    expect(extractFingerprints(["hello", "", undefined, null])).toEqual(new Set());
  });
});

describe("formatSummary", () => {
  const list = (...severities) => severities.map((severity) => ({ severity }));

  test("counts new issues by severity from high to low", () => {
    const summary = formatSummary(list("low", "high", "medium", "medium"));
    expect(summary).toContain("Found 4 new issues in the changed lines: 1 high, 2 medium, 1 low.");
  });

  test("uses the singular for a single issue and leaves out empty severities", () => {
    expect(formatSummary(list("low"))).toContain("Found 1 new issue in the changed lines: 1 low.");
  });

  test("mentions issues that were left out of the comments", () => {
    expect(formatSummary(list("low", "low"), { omitted: 2 })).toContain("2 more issues not commented here");
    expect(formatSummary(list("low"), { omitted: 1 })).toContain("1 more issue not commented here");
  });

  test("says when only part of a large pull request was reviewed", () => {
    expect(formatSummary(list("low"), { truncated: true })).toContain("only part of the diff was reviewed");
  });

  test("stays quiet about limits when nothing was cut", () => {
    const summary = formatSummary(list("low"));
    expect(summary.includes("not commented")).toBe(false);
    expect(summary.includes("only part")).toBe(false);
  });
});

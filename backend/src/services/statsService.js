async function getRuleStats({ ReviewRun, Finding }, repoIds, since) {
  const runs = await ReviewRun.find({ repo: { $in: repoIds }, createdAt: { $gte: since } }).select("_id");
  if (runs.length === 0) return [];

  const rows = await Finding.aggregate([
    { $match: { run: { $in: runs.map((run) => run._id) } } },
    { $group: { _id: "$ruleId", severity: { $first: "$severity" }, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  return rows.map((row) => ({ ruleId: row._id, severity: row.severity, count: row.count }));
}

async function getSummary({ ReviewRun }, repoIds, since) {
  const [row] = await ReviewRun.aggregate([
    { $match: { repo: { $in: repoIds }, createdAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        runs: { $sum: 1 },
        findings: { $sum: "$findingsCount" },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        avgDurationMs: { $avg: "$durationMs" },
      },
    },
  ]);
  if (!row) return { runs: 0, findings: 0, failed: 0, avgDurationMs: null };
  return {
    runs: row.runs,
    findings: row.findings,
    failed: row.failed,
    avgDurationMs: row.avgDurationMs == null ? null : Math.round(row.avgDurationMs),
  };
}

module.exports = { getRuleStats, getSummary };

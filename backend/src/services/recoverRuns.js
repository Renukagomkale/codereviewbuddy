async function failInterruptedRuns(ReviewRun) {
  const result = await ReviewRun.updateMany(
    { status: { $in: ["queued", "running"] } },
    { status: "failed", error: "Interrupted before it finished (the server restarted)" }
  );
  return result.modifiedCount;
}

module.exports = { failInterruptedRuns };

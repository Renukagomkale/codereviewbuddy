const { failInterruptedRuns } = require("../src/services/recoverRuns");

function fakeModel(statuses) {
  const docs = statuses.map((status, index) => ({ _id: index, status }));
  return {
    docs,
    async updateMany(filter, update) {
      const matching = docs.filter((doc) => filter.status.$in.includes(doc.status));
      matching.forEach((doc) => Object.assign(doc, update));
      return { modifiedCount: matching.length };
    },
  };
}

describe("failInterruptedRuns", () => {
  test("marks queued and running runs as failed with a reason", async () => {
    const ReviewRun = fakeModel(["queued", "running"]);
    await failInterruptedRuns(ReviewRun);
    expect(ReviewRun.docs.map((doc) => doc.status)).toEqual(["failed", "failed"]);
    expect(ReviewRun.docs[0].error).toContain("server restarted");
  });

  test("leaves finished runs alone", async () => {
    const ReviewRun = fakeModel(["done", "failed"]);
    await failInterruptedRuns(ReviewRun);
    expect(ReviewRun.docs.map((doc) => doc.status)).toEqual(["done", "failed"]);
    expect(ReviewRun.docs[0].error).toBe(undefined);
  });

  test("returns how many runs were changed", async () => {
    expect(await failInterruptedRuns(fakeModel(["queued", "done", "running"]))).toBe(2);
    expect(await failInterruptedRuns(fakeModel(["done"]))).toBe(0);
  });
});

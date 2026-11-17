const { parseDays } = require("../utils/query");
const { findOwnedRepo } = require("../services/ownership");
const { getRuleStats, getSummary } = require("../services/statsService");

const DAY_MS = 24 * 60 * 60 * 1000;

function createStatsHandlers({ Repo, ReviewRun, Finding }) {
  async function scopeOf(req) {
    const days = parseDays(req.query.days);
    const repos =
      req.query.repo === undefined
        ? await Repo.find({ user: req.userId }).select("_id")
        : [await findOwnedRepo(Repo, req.query.repo, req.userId)];
    return { days, repoIds: repos.map((repo) => repo._id), since: new Date(Date.now() - days * DAY_MS) };
  }

  return {
    async rules(req, res) {
      const { days, repoIds, since } = await scopeOf(req);
      res.json({ days, rules: await getRuleStats({ ReviewRun, Finding }, repoIds, since) });
    },

    async summary(req, res) {
      const { days, repoIds, since } = await scopeOf(req);
      res.json({ days, ...(await getSummary({ ReviewRun }, repoIds, since)) });
    },
  };
}

module.exports = { createStatsHandlers };

const HttpError = require("../utils/httpError");
const { parsePagination, paginated } = require("../utils/query");
const { parseFullName, parseDisabledRules, escapeRegex } = require("../utils/validators");
const { toRepoDto } = require("../services/dto");
const { findOwnedRepo } = require("../services/ownership");

function createRepoHandlers({ Repo }) {
  return {
    async list(req, res) {
      const pagination = parsePagination(req.query);
      const filter = { user: req.userId };
      const repos = await Repo.find(filter)
        .sort({ fullName: 1 })
        .skip(pagination.skip)
        .limit(pagination.limit);
      const total = await Repo.countDocuments(filter);
      res.json(paginated(repos.map(toRepoDto), total, pagination));
    },

    async claim(req, res) {
      const fullName = parseFullName((req.body || {}).fullName);
      const byName = new RegExp(`^${escapeRegex(fullName)}$`, "i");

      const claimed = await Repo.findOneAndUpdate(
        { fullName: byName, user: { $in: [null, req.userId] } },
        { user: req.userId },
        { new: true }
      );
      if (claimed) return res.json({ repo: toRepoDto(claimed) });

      const existing = await Repo.findOne({ fullName: byName });
      if (!existing) {
        throw new HttpError(404, "No review has run on this repository yet. Open a pull request first.");
      }
      throw new HttpError(409, "This repository is already connected to another account");
    },

    async updateSettings(req, res) {
      const disabledRules = parseDisabledRules((req.body || {}).disabledRules);
      await findOwnedRepo(Repo, req.params.id, req.userId);
      const repo = await Repo.findOneAndUpdate(
        { _id: req.params.id, user: req.userId },
        { disabledRules },
        { new: true }
      );
      res.json({ repo: toRepoDto(repo) });
    },
  };
}

module.exports = { createRepoHandlers };

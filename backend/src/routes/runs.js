const HttpError = require("../utils/httpError");
const { isObjectId } = require("../utils/objectId");
const { parsePagination, paginated } = require("../utils/query");
const { toRunDto, toFindingDto } = require("../services/dto");
const { findOwnedRepo } = require("../services/ownership");
const { compareBySeverity } = require("../services/severity");

const MAX_FINDINGS = 500;

function createRunHandlers({ Repo, ReviewRun, Finding }) {
  return {
    async list(req, res) {
      const pagination = parsePagination(req.query);
      const repos =
        req.query.repo === undefined
          ? await Repo.find({ user: req.userId })
          : [await findOwnedRepo(Repo, req.query.repo, req.userId)];
      const names = new Map(repos.map((repo) => [String(repo._id), repo.fullName]));

      const filter = { repo: { $in: repos.map((repo) => repo._id) } };
      const runs = await ReviewRun.find(filter)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit);
      const total = await ReviewRun.countDocuments(filter);

      const items = runs.map((run) => toRunDto(run, names.get(String(run.repo))));
      res.json(paginated(items, total, pagination));
    },

    async get(req, res) {
      const run = isObjectId(req.params.id) ? await ReviewRun.findById(req.params.id) : null;
      const repo = run ? await Repo.findOne({ _id: run.repo, user: req.userId }) : null;
      if (!run || !repo) throw new HttpError(404, "Run not found");

      const findings = await Finding.find({ run: run._id }).limit(MAX_FINDINGS);
      res.json({
        run: toRunDto(run, repo.fullName),
        findings: findings.map(toFindingDto).sort(compareBySeverity),
      });
    },
  };
}

module.exports = { createRunHandlers };

const HttpError = require("../utils/httpError");
const { isObjectId } = require("../utils/objectId");

async function findOwnedRepo(Repo, repoId, userId) {
  const repo = isObjectId(repoId) ? await Repo.findOne({ _id: repoId, user: userId }) : null;
  if (!repo) throw new HttpError(404, "Repository not found");
  return repo;
}

module.exports = { findOwnedRepo };

const HttpError = require("../utils/httpError");

const HANDLED_ACTIONS = new Set(["opened", "synchronize", "reopened"]);
const DUPLICATE_KEY = 11000;

function parsePayload(rawBody) {
  try {
    return JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new HttpError(400, "Webhook body is not valid JSON");
  }
}

function createWebhookHandler({ Repo, ReviewRun, enqueueReview }) {
  return async function handleWebhook(req, res, next) {
    try {
      const event = req.headers["x-github-event"];
      const deliveryId = req.headers["x-github-delivery"];
      if (!event || !deliveryId) throw new HttpError(400, "Missing GitHub event headers");

      const payload = parsePayload(req.body);

      if (event === "ping") return res.status(200).json({ status: "pong" });
      if (event !== "pull_request" || !HANDLED_ACTIONS.has(payload.action)) {
        return res.status(200).json({ status: "ignored" });
      }

      const { repository, pull_request: pullRequest } = payload;
      if (!repository || !pullRequest) throw new HttpError(400, "Missing pull request data");

      const update = { $setOnInsert: { owner: repository.owner.login, name: repository.name } };
      const installationId = payload.installation && payload.installation.id;
      if (installationId) update.$set = { installationId };

      const repo = await Repo.findOneAndUpdate({ fullName: repository.full_name }, update, { upsert: true, new: true });

      let run;
      try {
        run = await ReviewRun.create({
          repo: repo._id,
          prNumber: pullRequest.number,
          headSha: pullRequest.head.sha,
          deliveryId,
        });
      } catch (error) {
        if (error.code === DUPLICATE_KEY) return res.status(200).json({ status: "duplicate" });
        throw error;
      }

      res.status(202).json({ status: "queued", runId: run._id });

      Promise.resolve()
        .then(() => enqueueReview(run))
        .catch((error) => console.error("Failed to start review", error));
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { createWebhookHandler };

const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const Repo = require("./models/Repo");
const User = require("./models/User");
const ReviewRun = require("./models/ReviewRun");
const Finding = require("./models/Finding");
const { createGithubClient } = require("./services/githubClient");
const { createInstallationTokens } = require("./services/installationTokens");
const { analyzeFiles } = require("./services/analyzerClient");
const { createRuleCatalog } = require("./services/ruleCatalog");
const { createTokenService } = require("./services/tokens");
const { hashPassword, verifyPassword } = require("./services/passwords");
const { createReviewJob } = require("./jobs/reviewJob");
const { verifySignature } = require("./middleware/verifySignature");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { createWebhookHandler } = require("./routes/webhook");
const { createApiRouter } = require("./routes/api");
const { createAuthHandlers } = require("./routes/auth");
const { createRepoHandlers } = require("./routes/repos");
const { createRunHandlers } = require("./routes/runs");
const { createStatsHandlers } = require("./routes/stats");
const { createRuleHandlers } = require("./routes/rules");

function createApp() {
  const app = express();
  const tokens = createTokenService(env.jwtSecret);
  const tokenFor = env.githubApp ? createInstallationTokens(env.githubApp) : async () => env.githubToken;

  const enqueueReview = createReviewJob({
    Repo,
    ReviewRun,
    Finding,
    github: createGithubClient(tokenFor),
    analyze: (files) => analyzeFiles(env.analyzerUrl, files),
  });

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.post(
    "/webhooks/github",
    express.raw({ type: "application/json", limit: "5mb" }),
    verifySignature(env.webhookSecret),
    createWebhookHandler({ Repo, ReviewRun, enqueueReview })
  );

  app.use(
    "/api",
    cors({ origin: env.frontendUrl }),
    createApiRouter({
      tokens,
      auth: createAuthHandlers({ User, hashPassword, verifyPassword, tokens }),
      repos: createRepoHandlers({ Repo }),
      runs: createRunHandlers({ Repo, ReviewRun, Finding }),
      stats: createStatsHandlers({ Repo, ReviewRun, Finding }),
      rules: createRuleHandlers({ ruleCatalog: createRuleCatalog(env.analyzerUrl) }),
    })
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

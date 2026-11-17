const express = require("express");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/requireAuth");

function createApiRouter({ tokens, auth, repos, runs, stats, rules }) {
  const router = express.Router();
  const protect = requireAuth(tokens);
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message: "Too many attempts. Try again later." } },
  });

  router.use(express.json({ limit: "100kb" }));

  router.post("/auth/register", authLimiter, asyncHandler(auth.register));
  router.post("/auth/login", authLimiter, asyncHandler(auth.login));
  router.get("/auth/me", protect, asyncHandler(auth.me));

  router.get("/rules", protect, asyncHandler(rules.list));

  router.get("/repos", protect, asyncHandler(repos.list));
  router.post("/repos/claim", protect, asyncHandler(repos.claim));
  router.patch("/repos/:id/settings", protect, asyncHandler(repos.updateSettings));

  router.get("/runs", protect, asyncHandler(runs.list));
  router.get("/runs/:id", protect, asyncHandler(runs.get));

  router.get("/stats/summary", protect, asyncHandler(stats.summary));
  router.get("/stats/rules", protect, asyncHandler(stats.rules));

  return router;
}

module.exports = { createApiRouter };

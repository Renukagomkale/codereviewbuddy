require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../src/models/User");
const Repo = require("../src/models/Repo");
const ReviewRun = require("../src/models/ReviewRun");
const Finding = require("../src/models/Finding");

const DEMO_EMAIL = "demo@codereviewbuddy.dev";
const DEMO_PASSWORD = "demo-password-123";
const DAY_MS = 24 * 60 * 60 * 1000;
const RUN_COUNT = 45;

const RULES = [
  { ruleId: "print-call", severity: "low", weight: 5, message: "Leftover print call. Remove it or use logging.", ext: "py" },
  { ruleId: "unused-import", severity: "low", weight: 5, message: "Import is never used.", ext: "py" },
  { ruleId: "console-log", severity: "low", weight: 4, message: "Leftover console.log. Remove it or use a proper logger.", ext: "js" },
  { ruleId: "todo-comment", severity: "low", weight: 3, message: "Leftover TODO comment. Resolve it or track it as an issue.", ext: "js" },
  { ruleId: "bare-except", severity: "medium", weight: 3, message: "Bare 'except:' also catches KeyboardInterrupt and SystemExit.", ext: "py" },
  { ruleId: "loose-equality", severity: "medium", weight: 3, message: "Use === or !== to avoid unexpected type coercion.", ext: "js" },
  { ruleId: "var-declaration", severity: "medium", weight: 2, message: "Use let or const instead of var.", ext: "js" },
  { ruleId: "empty-catch", severity: "medium", weight: 2, message: "Empty catch block swallows errors silently.", ext: "js" },
  { ruleId: "long-function", severity: "medium", weight: 1, message: "Function is too long. Consider splitting it.", ext: "py" },
  { ruleId: "mutable-default", severity: "high", weight: 2, message: "Mutable default argument is shared between calls.", ext: "py" },
  { ruleId: "hardcoded-secret", severity: "high", weight: 1, message: "Possible hardcoded secret. Move it to an environment variable.", ext: "js" },
];
const FILES = ["app", "utils", "service", "handlers", "models", "client"];
const REPOS = [
  { fullName: "demo-org/payments-api", disabledRules: [] },
  { fullName: "demo-org/web-dashboard", disabledRules: ["todo-comment"] },
];

function createRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRule(random) {
  const total = RULES.reduce((sum, rule) => sum + rule.weight, 0);
  let roll = random() * total;
  return RULES.find((rule) => (roll -= rule.weight) < 0) || RULES[0];
}

function hex(random, length) {
  return Array.from({ length }, () => Math.floor(random() * 16).toString(16)).join("");
}

async function clearPreviousDemo() {
  const user = await User.findOne({ email: DEMO_EMAIL });
  if (!user) return;
  const repos = await Repo.find({ user: user._id }).select("_id");
  const runs = await ReviewRun.find({ repo: { $in: repos.map((repo) => repo._id) } }).select("_id");
  await Finding.deleteMany({ run: { $in: runs.map((run) => run._id) } });
  await ReviewRun.deleteMany({ _id: { $in: runs.map((run) => run._id) } });
  await Repo.deleteMany({ user: user._id });
  await User.deleteOne({ _id: user._id });
}

async function seed() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");
  await mongoose.connect(process.env.MONGODB_URI);
  await clearPreviousDemo();

  const user = await User.create({
    email: DEMO_EMAIL,
    name: "Demo Reviewer",
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
  });
  const repos = [];
  for (const { fullName, disabledRules } of REPOS) {
    const [owner, name] = fullName.split("/");
    repos.push(await Repo.create({ fullName, owner, name, disabledRules, user: user._id }));
  }

  const random = createRandom(42);
  const runs = [];
  const findings = [];
  for (let index = 0; index < RUN_COUNT; index += 1) {
    const repo = repos[Math.floor(random() * repos.length)];
    const createdAt = new Date(Date.now() - random() * 28 * DAY_MS);
    const failed = random() < 0.07;
    const count = failed ? 0 : Math.floor(random() * 9);
    const runId = new mongoose.Types.ObjectId();

    for (let item = 0; item < count; item += 1) {
      const rule = pickRule(random);
      if (repo.disabledRules.includes(rule.ruleId)) continue;
      findings.push({
        _id: new mongoose.Types.ObjectId(),
        run: runId,
        path: `src/${FILES[Math.floor(random() * FILES.length)]}.${rule.ext}`,
        line: 1 + Math.floor(random() * 120),
        ruleId: rule.ruleId,
        severity: rule.severity,
        message: rule.message,
        fingerprint: hex(random, 16),
        posted: true,
        createdAt,
      });
    }

    runs.push({
      _id: runId,
      repo: repo._id,
      prNumber: 1 + Math.floor(random() * 60),
      headSha: hex(random, 40),
      deliveryId: `seed-${index}`,
      status: failed ? "failed" : "done",
      findingsCount: findings.filter((finding) => String(finding.run) === String(runId)).length,
      durationMs: 1200 + Math.floor(random() * 7800),
      ...(failed && { error: "GitHub API request failed" }),
      createdAt,
    });
  }

  await ReviewRun.collection.insertMany(runs);
  await Finding.collection.insertMany(findings);
  console.log(`Seeded ${runs.length} runs and ${findings.length} findings.`);
  console.log(`Login with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

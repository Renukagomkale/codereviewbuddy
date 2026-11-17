const env = require("./config/env");
const { connectDb } = require("./config/db");
const { createApp } = require("./app");
const ReviewRun = require("./models/ReviewRun");
const { failInterruptedRuns } = require("./services/recoverRuns");

async function start() {
  await connectDb(env.mongoUri);
  const interrupted = await failInterruptedRuns(ReviewRun);
  if (interrupted > 0) console.log(`Marked ${interrupted} interrupted run(s) as failed`);
  createApp().listen(env.port, () => {
    console.log(`Backend listening on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});

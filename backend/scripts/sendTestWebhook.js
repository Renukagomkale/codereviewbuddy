require("dotenv").config();
const crypto = require("crypto");

const payload = {
  action: "opened",
  number: 1,
  pull_request: { number: 1, head: { sha: "abc123def456" } },
  repository: {
    full_name: "Renukagomkale/cr-buddy-test",
    name: "cr-buddy-test",
    owner: { login: "Renukagomkale" },
  },
};

const body = JSON.stringify(payload);
const signature = `sha256=${crypto
  .createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET)
  .update(body)
  .digest("hex")}`;
const deliveryId = process.argv[2] || crypto.randomUUID();
const url = `http://localhost:${process.env.PORT || 4000}/webhooks/github`;

fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-github-event": "pull_request",
    "x-github-delivery": deliveryId,
    "x-hub-signature-256": signature,
  },
  body,
}).then(async (response) => {
  console.log(response.status, await response.json());
});

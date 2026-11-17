const jwt = require("jsonwebtoken");

const REFRESH_MARGIN_MS = 60 * 1000;

function createInstallationTokens({ appId, privateKey, fetchImpl = fetch, signJwt = jwt.sign, now = Date.now }) {
  const cache = new Map();

  return async function tokenFor(installationId) {
    if (!installationId) throw new Error("No GitHub App installation is linked to this repository");

    const cached = cache.get(installationId);
    if (cached && cached.expiresAt - now() > REFRESH_MARGIN_MS) return cached.token;

    const issuedAt = Math.floor(now() / 1000);
    const appJwt = signJwt({ iat: issuedAt - 60, exp: issuedAt + 540, iss: appId }, privateKey, {
      algorithm: "RS256",
    });
    const response = await fetchImpl(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub refused to create an installation token (status ${response.status})`);
    }
    const { token, expires_at: expiresAt } = await response.json();
    cache.set(installationId, { token, expiresAt: Date.parse(expiresAt) });
    return token;
  };
}

module.exports = { createInstallationTokens };

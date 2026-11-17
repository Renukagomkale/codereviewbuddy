const { createInstallationTokens } = require("../src/services/installationTokens");
const { failureOf } = require("./fakes");

const START = Date.parse("2026-11-16T10:00:00Z");
const inOneHour = (offsetSeconds = 0) => new Date(START + (3600 + offsetSeconds) * 1000).toISOString();
const granted = (token, expiresAt = inOneHour()) => ({
  ok: true,
  status: 201,
  json: async () => ({ token, expires_at: expiresAt }),
});

function setup(responses) {
  const calls = [];
  const signed = [];
  let clock = START;
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return responses.shift();
  };
  const signJwt = (payload, key, options) => {
    signed.push({ payload, key, options });
    return `app-jwt-${signed.length}`;
  };
  const tokenFor = createInstallationTokens({ appId: "12345", privateKey: "PEM", fetchImpl, signJwt, now: () => clock });
  return { tokenFor, calls, signed, advance: (ms) => (clock += ms) };
}

describe("installation tokens", () => {
  test("asks GitHub for an installation token using the app JWT", async () => {
    const { tokenFor, calls } = setup([granted("ghs_first")]);
    expect(await tokenFor(99)).toBe("ghs_first");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.github.com/app/installations/99/access_tokens");
    expect(calls[0].options.method).toBe("POST");
    expect(calls[0].options.headers.Authorization).toBe("Bearer app-jwt-1");
  });

  test("signs the JWT with RS256, the app id and a short lifetime", async () => {
    const { tokenFor, signed } = setup([granted("ghs_first")]);
    await tokenFor(99);
    const { payload, key, options } = signed[0];
    expect(options.algorithm).toBe("RS256");
    expect(key).toBe("PEM");
    expect(payload.iss).toBe("12345");
    expect(payload.exp - payload.iat).toBe(600);
    expect(payload.iat).toBe(Math.floor(START / 1000) - 60);
  });

  test("reuses a token that is still valid", async () => {
    const { tokenFor, calls } = setup([granted("ghs_first")]);
    await tokenFor(99);
    await tokenFor(99);
    expect(calls).toHaveLength(1);
  });

  test("gets a fresh token when less than a minute is left", async () => {
    const { tokenFor, calls, advance } = setup([granted("ghs_first"), granted("ghs_second")]);
    await tokenFor(99);
    advance(3541 * 1000);
    expect(await tokenFor(99)).toBe("ghs_second");
    expect(calls).toHaveLength(2);
  });

  test("keeps a separate token for each installation", async () => {
    const { tokenFor, calls } = setup([granted("ghs_a"), granted("ghs_b")]);
    expect(await tokenFor(1)).toBe("ghs_a");
    expect(await tokenFor(2)).toBe("ghs_b");
    expect(await tokenFor(1)).toBe("ghs_a");
    expect(calls).toHaveLength(2);
  });

  test("fails with the status code when GitHub refuses", async () => {
    const { tokenFor } = setup([{ ok: false, status: 401, json: async () => ({}) }]);
    const error = await failureOf(tokenFor(99));
    expect(error.message).toContain("401");
  });

  test("does not cache a failure", async () => {
    const { tokenFor } = setup([{ ok: false, status: 500, json: async () => ({}) }, granted("ghs_ok")]);
    await failureOf(tokenFor(99));
    expect(await tokenFor(99)).toBe("ghs_ok");
  });

  test("fails clearly when the repository has no installation", async () => {
    const { tokenFor, calls } = setup([]);
    for (const missing of [undefined, null, 0]) {
      const error = await failureOf(tokenFor(missing));
      expect(error.message).toContain("No GitHub App installation");
    }
    expect(calls).toHaveLength(0);
  });
});

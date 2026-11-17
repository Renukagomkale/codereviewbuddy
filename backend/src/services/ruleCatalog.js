const HttpError = require("../utils/httpError");

function createRuleCatalog(analyzerUrl, fetchImpl = fetch) {
  let cached = null;

  return {
    async getRules() {
      if (cached) return cached;
      try {
        const response = await fetchImpl(`${analyzerUrl}/rules`, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error(`status ${response.status}`);
        cached = (await response.json()).rules;
        return cached;
      } catch {
        throw new HttpError(502, "The rule list is unavailable right now");
      }
    },
  };
}

module.exports = { createRuleCatalog };

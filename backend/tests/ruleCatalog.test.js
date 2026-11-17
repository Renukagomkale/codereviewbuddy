const { createRuleCatalog } = require("../src/services/ruleCatalog");
const { createRuleHandlers } = require("../src/routes/rules");
const { createRes, failureOf } = require("./fakes");

const RULES = [{ id: "print-call", title: "Leftover print", language: "python", severity: "low", description: "d" }];

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { impl, calls };
}

const ok = (rules) => ({ ok: true, status: 200, json: async () => ({ rules }) });

describe("rule catalog", () => {
  test("loads the rules from the analyzer", async () => {
    const { impl, calls } = fakeFetch([ok(RULES)]);
    const catalog = createRuleCatalog("http://analyzer:8000", impl);
    expect(await catalog.getRules()).toEqual(RULES);
    expect(calls).toEqual(["http://analyzer:8000/rules"]);
  });

  test("asks the analyzer only once", async () => {
    const { impl, calls } = fakeFetch([ok(RULES)]);
    const catalog = createRuleCatalog("http://analyzer:8000", impl);
    await catalog.getRules();
    await catalog.getRules();
    expect(calls).toHaveLength(1);
  });

  test("answers 502 when the analyzer is unreachable or fails, and tries again later", async () => {
    const { impl } = fakeFetch([new Error("connection refused"), { ok: false, status: 500 }, ok(RULES)]);
    const catalog = createRuleCatalog("http://analyzer:8000", impl);
    expect((await failureOf(catalog.getRules())).status).toBe(502);
    expect((await failureOf(catalog.getRules())).status).toBe(502);
    expect(await catalog.getRules()).toEqual(RULES);
  });
});

describe("rules handler", () => {
  test("returns the catalog", async () => {
    const handlers = createRuleHandlers({ ruleCatalog: { getRules: async () => RULES } });
    const res = createRes();
    await handlers.list({}, res);
    expect(res.body).toEqual({ rules: RULES });
  });
});

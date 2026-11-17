const { analyzeFiles } = require("../src/services/analyzerClient");

const FILES = [{ path: "a.py", addedLines: [{ line: 1, text: "print(1)" }], content: "print(1)\n" }];
const FINDINGS = [{ path: "a.py", line: 1, ruleId: "print-call", severity: "low", message: "m" }];

function fakeFetch(response) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    return response;
  };
  return { impl, calls };
}

describe("analyzeFiles", () => {
  test("posts the files to the analyzer and returns its findings", async () => {
    const { impl, calls } = fakeFetch({ ok: true, status: 200, json: async () => ({ findings: FINDINGS }) });
    const result = await analyzeFiles("http://analyzer:8000", FILES, impl);
    expect(result).toEqual(FINDINGS);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://analyzer:8000/analyze");
    expect(calls[0].options.method).toBe("POST");
    expect(JSON.parse(calls[0].options.body)).toEqual({ files: FILES });
  });

  test("sends a JSON content type", async () => {
    const { impl, calls } = fakeFetch({ ok: true, status: 200, json: async () => ({ findings: [] }) });
    await analyzeFiles("http://analyzer:8000", FILES, impl);
    expect(calls[0].options.headers["content-type"]).toBe("application/json");
  });

  test("fails with the status code when the analyzer returns an error", async () => {
    const { impl } = fakeFetch({ ok: false, status: 422, json: async () => ({}) });
    let message = "";
    try {
      await analyzeFiles("http://analyzer:8000", FILES, impl);
    } catch (error) {
      message = error.message;
    }
    expect(message).toBe("Analyzer responded with status 422");
  });
});

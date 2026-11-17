const TIMEOUT_MS = 20000;

async function analyzeFiles(baseUrl, files, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Analyzer responded with status ${response.status}`);
  const { findings } = await response.json();
  return findings;
}

module.exports = { analyzeFiles };

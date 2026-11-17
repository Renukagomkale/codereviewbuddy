const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function parsePatch(patch) {
  if (!patch) return [];

  const addedLines = [];
  let oldRemaining = 0;
  let newRemaining = 0;
  let newLine = 0;

  for (const raw of patch.split("\n")) {
    const row = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    const inHunk = oldRemaining > 0 || newRemaining > 0;

    if (!inHunk) {
      const header = HUNK_HEADER.exec(row);
      if (header) {
        oldRemaining = header[2] === undefined ? 1 : Number(header[2]);
        newRemaining = header[4] === undefined ? 1 : Number(header[4]);
        newLine = Number(header[3]);
      }
      continue;
    }

    const marker = row[0];
    if (marker === "\\") continue;

    if (marker === "+") {
      addedLines.push({ line: newLine, text: row.slice(1) });
      newLine += 1;
      newRemaining -= 1;
    } else if (marker === "-") {
      oldRemaining -= 1;
    } else {
      newLine += 1;
      oldRemaining -= 1;
      newRemaining -= 1;
    }
  }

  return addedLines;
}

module.exports = { parsePatch };

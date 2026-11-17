const { parsePatch } = require("../src/services/diffParser");

function patchOf(...lines) {
  return lines.join("\n");
}

describe("parsePatch", () => {
  test("returns an empty list when there is no patch", () => {
    expect(parsePatch(undefined)).toEqual([]);
    expect(parsePatch(null)).toEqual([]);
    expect(parsePatch("")).toEqual([]);
  });

  test("maps an added line to its line number in the new file", () => {
    const patch = patchOf("@@ -1,3 +1,4 @@", " first", "+inserted", " second", " third");
    expect(parsePatch(patch)).toEqual([{ line: 2, text: "inserted" }]);
  });

  test("numbers consecutive added lines one after another", () => {
    const patch = patchOf("@@ -1,2 +1,5 @@", " a", "+b", "+c", "+d", " e");
    expect(parsePatch(patch)).toEqual([
      { line: 2, text: "b" },
      { line: 3, text: "c" },
      { line: 4, text: "d" },
    ]);
  });

  test("removed lines do not advance the new file line number", () => {
    const patch = patchOf("@@ -1,3 +1,3 @@", " a", "-b", "+B", " c");
    expect(parsePatch(patch)).toEqual([{ line: 2, text: "B" }]);
  });

  test("many removed lines before an addition do not shift it", () => {
    const patch = patchOf("@@ -1,4 +1,2 @@", " a", "-b", "-c", "-d", "+e");
    expect(parsePatch(patch)).toEqual([{ line: 2, text: "e" }]);
  });

  test("each hunk restarts from its own starting line", () => {
    const patch = patchOf(
      "@@ -1,2 +1,3 @@",
      " a",
      "+b",
      " c",
      "@@ -20,2 +21,3 @@",
      " x",
      "+y",
      " z"
    );
    expect(parsePatch(patch)).toEqual([
      { line: 2, text: "b" },
      { line: 22, text: "y" },
    ]);
  });

  test("a brand new file numbers every line from 1", () => {
    const patch = patchOf("@@ -0,0 +1,3 @@", "+a", "+b", "+c");
    expect(parsePatch(patch)).toEqual([
      { line: 1, text: "a" },
      { line: 2, text: "b" },
      { line: 3, text: "c" },
    ]);
  });

  test("a deleted file has no added lines", () => {
    const patch = patchOf("@@ -1,2 +0,0 @@", "-a", "-b");
    expect(parsePatch(patch)).toEqual([]);
  });

  test("hunk headers without counts mean one line", () => {
    const patch = patchOf("@@ -1 +1 @@", "-a", "+b");
    expect(parsePatch(patch)).toEqual([{ line: 1, text: "b" }]);
  });

  test("the function name after the hunk header is ignored", () => {
    const patch = patchOf("@@ -10,2 +10,3 @@ function render() {", " a", "+b", " c");
    expect(parsePatch(patch)).toEqual([{ line: 11, text: "b" }]);
  });

  test("no newline markers are ignored", () => {
    const patch = patchOf(
      "@@ -1 +1 @@",
      "-a",
      "\\ No newline at end of file",
      "+b",
      "\\ No newline at end of file"
    );
    expect(parsePatch(patch)).toEqual([{ line: 1, text: "b" }]);
  });

  test("windows line endings are removed from the text", () => {
    const patch = "@@ -1,2 +1,3 @@\r\n a\r\n+b\r\n c";
    expect(parsePatch(patch)).toEqual([{ line: 2, text: "b" }]);
  });

  test("an added line that starts with two plus signs is still an added line", () => {
    const patch = patchOf("@@ -1,1 +1,2 @@", " a", "+++counter");
    expect(parsePatch(patch)).toEqual([{ line: 2, text: "++counter" }]);
  });

  test("a removed line that starts with two dashes is still a removed line", () => {
    const patch = patchOf("@@ -1,2 +1,2 @@", "--- sql comment", "+kept");
    expect(parsePatch(patch)).toEqual([{ line: 1, text: "kept" }]);
  });

  test("blank context lines count as lines of the new file", () => {
    const patch = patchOf("@@ -1,3 +1,4 @@", " a", "", "+x", " b");
    expect(parsePatch(patch)).toEqual([{ line: 3, text: "x" }]);
  });

  test("file headers between hunks are not mistaken for changes", () => {
    const patch = patchOf(
      "@@ -1 +1,2 @@",
      " a",
      "+b",
      "diff --git a/other.js b/other.js",
      "--- a/other.js",
      "+++ b/other.js",
      "@@ -5 +5 @@",
      "-q",
      "+r"
    );
    expect(parsePatch(patch)).toEqual([
      { line: 2, text: "b" },
      { line: 5, text: "r" },
    ]);
  });

  test("an empty added line is kept", () => {
    const patch = patchOf("@@ -1 +1,2 @@", " a", "+");
    expect(parsePatch(patch)).toEqual([{ line: 2, text: "" }]);
  });

  test("a patch ending with a newline gives the same result", () => {
    const patch = patchOf("@@ -1,2 +1,3 @@", " a", "+b", " c", "");
    expect(parsePatch(patch)).toEqual([{ line: 2, text: "b" }]);
  });
});

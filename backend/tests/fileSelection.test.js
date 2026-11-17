const { selectFiles, MAX_FILES, MAX_PATCH_BYTES } = require("../src/services/fileSelection");

const PATCH = "@@ -0,0 +1 @@\n+x = 1";

function file(filename, overrides = {}) {
  return { filename, status: "added", patch: PATCH, ...overrides };
}

describe("selectFiles", () => {
  test("keeps added, modified and renamed files that have a patch", () => {
    const pullFiles = [
      file("a.py"),
      file("b.py", { status: "modified" }),
      file("c.py", { status: "renamed" }),
    ];
    expect(selectFiles(pullFiles)).toEqual({ files: pullFiles, truncated: false });
  });

  test("skips removed files", () => {
    expect(selectFiles([file("a.py", { status: "removed" })]).files).toEqual([]);
  });

  test("skips files without a patch, such as binaries or huge diffs", () => {
    expect(selectFiles([file("a.py", { patch: undefined }), file("b.py", { patch: "" })]).files).toEqual([]);
  });

  test("skips lock files, minified bundles and images", () => {
    const names = [
      "package-lock.json",
      "web/yarn.lock",
      "pnpm-lock.yaml",
      "Gemfile.lock",
      "dist/app.min.js",
      "styles.min.css",
      "logo.svg",
      "photo.PNG",
      "app.js.map",
    ];
    expect(selectFiles(names.map((name) => file(name))).files).toEqual([]);
  });

  test("does not skip files that only look similar", () => {
    const pullFiles = [file("lockfile.js"), file("src/minimal.js"), file("package.json")];
    expect(selectFiles(pullFiles).files).toHaveLength(3);
  });

  test("stops at the file limit and reports the cut", () => {
    const pullFiles = Array.from({ length: MAX_FILES + 5 }, (_, index) => file(`f${index}.py`));
    const result = selectFiles(pullFiles);
    expect(result.files).toHaveLength(MAX_FILES);
    expect(result.truncated).toBe(true);
  });

  test("stops when the patches get too large and reports the cut", () => {
    const big = "@@ -0,0 +1 @@\n+" + "x".repeat(MAX_PATCH_BYTES - 100);
    const result = selectFiles([file("a.py", { patch: big }), file("b.py", { patch: big })]);
    expect(result.files).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });
});

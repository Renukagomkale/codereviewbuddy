const MAX_FILES = 50;
const MAX_PATCH_BYTES = 300000;
const IGNORED_FILE =
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$|\.(min\.js|min\.css|map|lock|svg|png|jpe?g|gif|ico|pdf|woff2?|ttf|zip)$/i;

function selectFiles(pullFiles) {
  const candidates = pullFiles.filter(
    (file) => file.status !== "removed" && file.patch && !IGNORED_FILE.test(file.filename)
  );

  const files = [];
  let patchBytes = 0;
  for (const file of candidates) {
    patchBytes += Buffer.byteLength(file.patch);
    if (files.length >= MAX_FILES || patchBytes > MAX_PATCH_BYTES) {
      return { files, truncated: true };
    }
    files.push(file);
  }
  return { files, truncated: false };
}

module.exports = { selectFiles, MAX_FILES, MAX_PATCH_BYTES };

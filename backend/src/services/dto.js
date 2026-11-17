function toUserDto(user) {
  return { id: String(user._id), email: user.email, name: user.name || "" };
}

function toRepoDto(repo) {
  return {
    id: String(repo._id),
    fullName: repo.fullName,
    owner: repo.owner,
    name: repo.name,
    disabledRules: Array.from(repo.disabledRules || []),
  };
}

function toRunDto(run, repoFullName) {
  return {
    id: String(run._id),
    repoId: String(run.repo),
    repoFullName,
    prNumber: run.prNumber,
    headSha: run.headSha,
    status: run.status,
    findingsCount: run.findingsCount,
    durationMs: run.durationMs ?? null,
    error: run.error || null,
    createdAt: run.createdAt,
  };
}

function toFindingDto(finding) {
  return {
    id: String(finding._id),
    path: finding.path,
    line: finding.line,
    ruleId: finding.ruleId,
    severity: finding.severity,
    message: finding.message,
    posted: finding.posted,
  };
}

module.exports = { toUserDto, toRepoDto, toRunDto, toFindingDto };

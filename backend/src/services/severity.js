const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

function compareBySeverity(a, b) {
  return (
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    a.path.localeCompare(b.path) ||
    a.line - b.line
  );
}

module.exports = { compareBySeverity };

import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { api, getToken, setToken, useApi } from "./api";
import { Severity, Status, Heading, Stat, RunRows, Toggle, Empty, Loaded, formatDate, seconds } from "./ui";

const LANGUAGE = { python: "Python", javascript: "JavaScript", any: "Any language" };
const NO_REPOS = (
  <Empty title="No repositories yet">
    Open a pull request on a repository the bot can read, then connect it on the <Link to="/repos" className="text-primary underline">repos</Link> page.
  </Empty>
);

export function Overview() {
  const summary = useApi("/stats/summary");
  const rules = useApi("/stats/rules");
  const recent = useApi("/runs?limit=4");
  return (
    <>
      <Heading kicker="Last 30 days" title="What the bot caught" />
      <Loaded result={recent}>
        {({ items, total }) =>
          total === 0 ? (
            NO_REPOS
          ) : (
            <>
              <Loaded result={summary}>
                {(stats) => (
                  <section className="mb-12 grid grid-cols-2 divide-x divide-line border-y border-line bg-surface/70 sm:grid-cols-4">
                    <Stat value={stats.runs} label="reviews run" />
                    <Stat value={stats.findings} label="issues commented" />
                    <Stat value={stats.failed} label="failed runs" tone={stats.failed ? "text-persimmon" : ""} />
                    <Stat value={stats.avgDurationMs == null ? "-" : seconds(stats.avgDurationMs)} label="average review" />
                  </section>
                )}
              </Loaded>
              <div className="grid gap-12 xl:grid-cols-[1.15fr_1fr]">
                <section>
                  <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">Findings by rule</h2>
                  <Loaded result={rules}>
                    {(data) =>
                      data.rules.length === 0 ? (
                        <p className="text-sm text-muted">No findings in this period.</p>
                      ) : (
                        <ol className="border-t border-line">
                          {data.rules.map((rule, index) => (
                            <li key={rule.ruleId} className="grid grid-cols-[1.5rem_1fr_2rem] items-center gap-x-3 border-b border-line py-2">
                              <span className="font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-sm">{rule.ruleId}</span>
                                  <Severity level={rule.severity} />
                                </div>
                                <div className="mt-1.5 h-1.5 bg-line/60">
                                  <div className="h-full bg-primary" style={{ width: `${(rule.count / data.rules[0].count) * 100}%` }} />
                                </div>
                              </div>
                              <span className="text-right font-mono text-sm">{rule.count}</span>
                            </li>
                          ))}
                        </ol>
                      )
                    }
                  </Loaded>
                </section>
                <section>
                  <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">Recent runs</h2>
                  <RunRows items={items} compact />
                  <Link to="/runs" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    All runs <ArrowUpRight size={14} />
                  </Link>
                </section>
              </div>
            </>
          )
        }
      </Loaded>
    </>
  );
}

export function Runs() {
  const [page, setPage] = useState(1);
  const result = useApi(`/runs?page=${page}&limit=10`);
  const pager = "font-mono text-xs text-primary hover:underline disabled:text-muted disabled:no-underline";
  return (
    <>
      <Heading kicker="History" title="Every review the bot ran" />
      <Loaded result={result}>
        {({ items, total, totalPages }) =>
          total === 0 ? (
            NO_REPOS
          ) : (
            <>
              <RunRows items={items} />
              <div className="mt-4 flex items-center gap-5">
                <button className={pager} disabled={page <= 1} onClick={() => setPage(page - 1)}>&larr; newer</button>
                <span className="font-mono text-xs text-muted">Page {page} of {totalPages}</span>
                <button className={pager} disabled={page >= totalPages} onClick={() => setPage(page + 1)}>older &rarr;</button>
              </div>
            </>
          )
        }
      </Loaded>
    </>
  );
}

export function RunDetail() {
  const { id } = useParams();
  const result = useApi(`/runs/${id}`);
  return (
    <>
      <Link to="/runs" className="mb-6 inline-block font-mono text-xs text-muted hover:text-ink">&larr; all runs</Link>
      <Loaded result={result}>
        {({ run, findings }) => {
          const files = [...new Set(findings.map((finding) => finding.path))];
          return (
            <>
              <Heading kicker={run.repoFullName} title={`Pull request #${run.prNumber}`} />
              <p className="-mt-4 mb-10 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-muted">
                <Status status={run.status} />
                <span>commit {run.headSha.slice(0, 7)}</span>
                <span>{run.durationMs == null ? "-" : seconds(run.durationMs)}</span>
                <span>{formatDate(run.createdAt)}</span>
              </p>
              {run.error && <p className="mb-8 border-l-4 border-persimmon bg-surface px-4 py-3 text-sm">{run.error}</p>}
              {findings.length === 0 && !run.error && <p className="text-sm text-muted">No new issues were commented on this run.</p>}
              <div className="space-y-8">
                {files.map((path) => (
                  <section key={path}>
                    <h2 className="mb-1 truncate border-b border-ink pb-1 font-mono text-sm font-medium">{path}</h2>
                    <ul className="divide-y divide-line">
                      {findings.filter((finding) => finding.path === path).map((finding) => (
                        <li key={finding.id} className="grid grid-cols-[3rem_1fr] gap-x-3 py-3">
                          <span className="pt-0.5 text-right font-mono text-xs text-muted">L{finding.line}</span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Severity level={finding.severity} />
                              <span className="font-mono text-xs text-muted">{finding.ruleId}</span>
                            </div>
                            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed">{finding.message}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          );
        }}
      </Loaded>
    </>
  );
}

function RepoCard({ repo, catalog }) {
  const [disabled, setDisabled] = useState(repo.disabledRules);
  const [error, setError] = useState("");
  const languages = [...new Set(catalog.map((rule) => rule.language))];

  async function flip(ruleId) {
    const previous = disabled;
    const next = previous.includes(ruleId) ? previous.filter((id) => id !== ruleId) : [...previous, ruleId];
    setDisabled(next);
    setError("");
    try {
      await api(`/repos/${repo.id}/settings`, { method: "PATCH", body: { disabledRules: next } });
    } catch (failure) {
      setDisabled(previous);
      setError(failure.message);
    }
  }

  return (
    <section className="border border-line bg-surface/80">
      <h2 className="border-b border-line px-4 py-3 font-mono text-sm font-medium">{repo.fullName}</h2>
      <div className="grid gap-x-10 gap-y-6 p-4 md:grid-cols-3">
        {languages.map((language) => (
          <div key={language}>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">{LANGUAGE[language] || language}</p>
            {catalog.filter((rule) => rule.language === language).map((rule) => (
              <div key={rule.id} className="flex items-center justify-between gap-3 py-1.5 text-sm" title={rule.description}>
                {rule.title}
                <Toggle on={!disabled.includes(rule.id)} onChange={() => flip(rule.id)} label={rule.title} />
              </div>
            ))}
          </div>
        ))}
      </div>
      {error && <p className="border-t border-line px-4 py-2 text-sm text-persimmon">{error}</p>}
    </section>
  );
}

export function Repos() {
  const repos = useApi("/repos?limit=100");
  const catalog = useApi("/rules");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function connect(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/repos/claim", { method: "POST", body: { fullName: name } });
      setName("");
      repos.reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Heading kicker="Connected" title="Repositories and rules" />
      <form onSubmit={connect} className="mb-3 flex max-w-xl flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="owner/name, as shown on GitHub"
          className="min-w-0 flex-1 border border-line bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-primary"
        />
        <button disabled={busy} className="bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-ink disabled:opacity-60">
          {busy ? "Connecting" : "Connect repository"}
        </button>
      </form>
      <p className="mb-10 min-h-5 text-sm text-persimmon">{error}</p>
      <Loaded result={repos}>
        {({ items }) =>
          items.length === 0 ? (
            <Empty title="Nothing connected">
              The bot reviews a repository once a pull request is opened on it. After that, type its name above to connect it to your account.
            </Empty>
          ) : (
            <Loaded result={catalog}>
              {({ rules }) => (
                <div className="space-y-8">
                  {items.map((repo) => (
                    <RepoCard key={repo.id} repo={repo} catalog={rules} />
                  ))}
                </div>
              )}
            </Loaded>
          )
        }
      </Loaded>
    </>
  );
}

function Backdrop() {
  return (
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
      <rect width="1200" height="800" fill="#2d5e8c" />
      <path d="M0 800 L520 280 L1200 800 Z" fill="#244f78" />
      <circle cx="260" cy="210" r="190" fill="none" stroke="#8db4d9" strokeOpacity=".35" strokeWidth="2" />
      <circle cx="260" cy="210" r="120" fill="none" stroke="#8db4d9" strokeOpacity=".2" strokeWidth="2" />
      <rect x="640" y="-40" width="26" height="380" rx="13" fill="#8db4d9" fillOpacity=".35" />
      <rect x="690" y="-40" width="26" height="250" rx="13" fill="#8db4d9" fillOpacity=".2" />
      <path d="M1200 520 A300 300 0 0 0 900 820 L1200 820 Z" fill="#d9532b" />
      <circle cx="905" cy="140" r="34" fill="#c9cf3f" />
    </svg>
  );
}

export function Login() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const label = "block font-mono text-[11px] uppercase tracking-widest text-muted";
  const field = "mt-1.5 w-full border border-line bg-white px-3 py-2.5 font-sans text-base normal-case tracking-normal text-ink outline-none focus:border-primary";
  const bind = (key) => ({ value: form[key], onChange: (event) => setForm({ ...form, [key]: event.target.value }) });

  if (getToken()) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = creating ? form : { email: form.email, password: form.password };
      const data = await api(creating ? "/auth/register" : "/auth/login", { method: "POST", body });
      setToken(data.token);
      navigate("/");
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center overflow-hidden">
      <Backdrop />
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-12 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:px-12">
        <div className="text-white">
          <p className="font-mono text-lg font-medium">
            <span className="text-coolblue">crb</span>/review
          </p>
          <h1 className="mt-12 text-5xl font-semibold leading-[1.05] tracking-tight lg:mt-20 lg:text-7xl">
            {creating ? "Let\u2019s get you set up." : "Welcome back."}
          </h1>
          <div className="my-7 h-0.5 w-16 bg-white" />
          <p className="max-w-sm text-sm leading-relaxed text-white/80">
            Every pull request gets a review of its changed lines. No noise on code you did not touch.
          </p>
        </div>
        <form onSubmit={submit} className="w-full max-w-md space-y-5 border border-ink bg-surface p-7 shadow-[10px_10px_0_rgba(29,39,51,0.35)] sm:p-9 lg:justify-self-end">
          <h2 className="text-2xl font-semibold">{creating ? "Create account" : "Sign in"}</h2>
          {creating && <label className={label}>Name<input className={field} {...bind("name")} /></label>}
          <label className={label}>Email<input type="email" required className={field} {...bind("email")} /></label>
          <label className={label}>Password<input type="password" required minLength={8} className={field} {...bind("password")} /></label>
          {error && <p className="text-sm text-persimmon">{error}</p>}
          <button disabled={busy} className="w-full bg-persimmon py-3 text-sm font-semibold text-white hover:bg-ink disabled:opacity-60">
            {creating ? "Create account" : "Sign in"}
          </button>
          <button type="button" onClick={() => setCreating(!creating)} className="text-sm text-primary hover:underline">
            {creating ? "I already have an account" : "Create an account"}
          </button>
        </form>
      </div>
    </div>
  );
}

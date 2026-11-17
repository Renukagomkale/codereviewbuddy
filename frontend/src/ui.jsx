import { Link, NavLink, Outlet } from "react-router-dom";
import { OctagonAlert, TriangleAlert, Info, Check, X, Clock, Loader, GitPullRequest } from "lucide-react";
import { clearToken } from "./api";

const SEVERITY = {
  high: { label: "High", Icon: OctagonAlert, tone: "bg-persimmon text-white" },
  medium: { label: "Medium", Icon: TriangleAlert, tone: "bg-wasabi text-ink" },
  low: { label: "Low", Icon: Info, tone: "bg-coolblue text-ink" },
};

export function Severity({ level }) {
  const { label, Icon, tone } = SEVERITY[level];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide ${tone}`}>
      <Icon size={12} strokeWidth={2.5} />
      {label}
    </span>
  );
}

const STATUS = {
  done: { Icon: Check, tone: "text-primary" },
  failed: { Icon: X, tone: "text-persimmon" },
  running: { Icon: Loader, tone: "text-muted" },
  queued: { Icon: Clock, tone: "text-muted" },
};

export function Status({ status }) {
  const { Icon, tone } = STATUS[status] || STATUS.queued;
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs ${tone}`}>
      <Icon size={14} />
      {status}
    </span>
  );
}

export const formatDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

export function Shell() {
  const link = ({ isActive }) =>
    `font-mono text-sm py-1 border-b-2 ${isActive ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink"}`;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[14rem_1fr]">
      <aside className="flex items-center justify-between gap-6 border-b border-line bg-surface/80 px-5 py-4 lg:flex-col lg:items-start lg:justify-start lg:gap-10 lg:border-b-0 lg:border-r lg:px-7 lg:py-10">
        <div className="font-mono text-lg font-medium leading-none">
          <span className="text-primary">crb</span>
          <span className="text-muted">/</span>review
        </div>
        <nav className="flex gap-5 lg:flex-col lg:gap-3">
          <NavLink to="/" end className={link}>overview</NavLink>
          <NavLink to="/runs" className={link}>runs</NavLink>
          <NavLink to="/repos" className={link}>repos</NavLink>
        </nav>
        <Link to="/login" onClick={clearToken} className="font-mono text-xs text-muted hover:text-ink lg:mt-auto">sign out</Link>
      </aside>
      <main className="px-5 py-8 lg:px-14 lg:py-12">
        <Outlet />
      </main>
    </div>
  );
}

export function Heading({ kicker, title }) {
  return (
    <header className="mb-8">
      <p className="font-mono text-xs uppercase tracking-widest text-primary">{kicker}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight lg:text-4xl">{title}</h1>
    </header>
  );
}

export function Stat({ value, label, tone = "" }) {
  return (
    <div className="px-5 py-4 first:pl-0">
      <p className={`text-4xl font-semibold tabular-nums lg:text-5xl ${tone}`}>{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

export function RunRows({ items, compact = false }) {
  return (
    <ul className="divide-y divide-line border-y border-line bg-surface/70">
      {items.map((run) => (
        <li key={run.id}>
          <Link
            to={`/runs/${run.id}`}
            className={`grid items-center gap-x-4 gap-y-1 px-3 py-3.5 hover:bg-white ${
              compact ? "grid-cols-[1fr_auto]" : "grid-cols-[1fr_auto] sm:grid-cols-[1fr_7rem_6rem_4.5rem]"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <GitPullRequest size={15} className="shrink-0 text-muted" />
              <span className="truncate font-medium">{run.repoFullName}</span>
              <span className="font-mono text-sm text-muted">#{run.prNumber}</span>
            </span>
            <Status status={run.status} />
            <span className={`font-mono text-xs text-muted ${compact ? "col-span-2" : "col-start-1 sm:col-start-auto sm:text-right"}`}>
              {run.findingsCount} {run.findingsCount === 1 ? "finding" : "findings"}
              {compact && ` · ${formatDate(run.createdAt)}`}
            </span>
            {!compact && <span className="text-right font-mono text-xs text-muted">{formatDate(run.createdAt)}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Loading() {
  return <p className="py-10 font-mono text-sm text-muted">Loading&hellip;</p>;
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="my-6 border-l-4 border-persimmon bg-surface px-4 py-3 text-sm">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-mono text-xs text-primary hover:underline">
          try again
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="max-w-lg border border-dashed border-muted/50 bg-surface/60 px-6 py-10">
      <p className="text-lg font-semibold">{title}</p>
      <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

export function Loaded({ result, children }) {
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorBox message={result.error} onRetry={result.reload} />;
  return children(result.data);
}

export function Toggle({ on, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 border ${on ? "border-primary bg-primary" : "border-muted bg-transparent"}`}
    >
      <span className={`absolute top-0.5 h-3.5 w-3.5 transition-all ${on ? "left-[1.1rem] bg-white" : "left-0.5 bg-muted"}`} />
    </button>
  );
}


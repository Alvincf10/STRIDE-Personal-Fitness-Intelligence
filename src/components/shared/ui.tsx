import { cn } from "@/lib/utils/cn";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="section-label mb-2">{eyebrow}</p> : null}
        <h1 className="text-[clamp(1.5rem,6vw,2.35rem)] font-extrabold tracking-tight text-[var(--text)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap [&_button]:w-full sm:[&_button]:w-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function Panel({
  children,
  className,
  hero = false,
}: {
  children: React.ReactNode;
  className?: string;
  hero?: boolean;
}) {
  return (
    <section
      className={cn(
        "card-surface p-4 sm:p-5",
        hero && "card-hero",
        className
      )}
    >
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  size = "md",
}: {
  label: string;
  value: string;
  hint?: string;
  size?: "md" | "lg";
}) {
  return (
    <Panel>
      <p className="section-label">{label}</p>
      <p
        className={cn(
          "metric-figure mt-3 font-extrabold text-[var(--text)]",
          size === "lg" ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs text-[var(--muted)] sm:text-sm">{hint}</p>
      ) : null}
    </Panel>
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  return (
    <button
      className={cn(
        "pressable inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-[var(--accent)] text-[#07140F] hover:brightness-110",
        variant === "ghost" &&
          "border border-[var(--border)] bg-[var(--surface-raised)]/60 text-[var(--text)] hover:border-[var(--accent)]/40",
        variant === "danger" &&
          "bg-[var(--danger)] text-[#07140F] hover:brightness-110",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 text-base text-[var(--text)] placeholder:text-[var(--muted)] sm:text-sm",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 text-base text-[var(--text)] sm:text-sm",
        props.className
      )}
    />
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <Panel className="border-dashed">
      <p className="text-lg font-semibold text-[var(--text)]">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
    </Panel>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Panel className="border-[var(--danger)]/40">
      <p className="font-semibold text-[var(--danger)]">Couldn’t load this</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{message}</p>
    </Panel>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <Panel>
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--accent)]" />
        <p className="text-sm text-[var(--muted)]">{label}</p>
      </div>
    </Panel>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "warning" | "danger" | "easy" | "moderate" | "intense";
}) {
  const colors = {
    neutral: "border-[var(--border)] text-[var(--muted)]",
    accent: "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]",
    warning: "border-[var(--warning)]/40 text-[var(--warning)]",
    danger: "border-[var(--danger)]/40 text-[var(--danger)]",
    easy: "border-[var(--soft-green)]/50 bg-[var(--soft-green)]/15 text-[#8FE0B8]",
    moderate: "border-[var(--warning)]/50 bg-[var(--warning)]/10 text-[var(--warning)]",
    intense: "border-[var(--danger)]/50 bg-[var(--danger)]/10 text-[#FF9B9B]",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        colors[tone]
      )}
    >
      {children}
    </span>
  );
}

export function IntensityBadge({
  averageHeartRateBpm,
}: {
  averageHeartRateBpm?: number;
}) {
  if (averageHeartRateBpm == null || !Number.isFinite(averageHeartRateBpm)) {
    return <Badge>Pace only</Badge>;
  }
  if (averageHeartRateBpm < 130) return <Badge tone="easy">Easy</Badge>;
  if (averageHeartRateBpm < 155) return <Badge tone="moderate">Moderate</Badge>;
  return <Badge tone="intense">Intense</Badge>;
}

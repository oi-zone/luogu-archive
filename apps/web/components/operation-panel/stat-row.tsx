type StatRowProps = {
  label: string;
  value: string;
  hint?: string;
};

export default function StatRow({ label, value, hint }: StatRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
      {hint ? (
        <span className="text-xs text-muted-foreground/70">{hint}</span>
      ) : null}
    </div>
  );
}


export default function MetricCard({
    label,
    value,
    unit,
    icon,
    color = "#38bdf8",
    subtext,
  }: {
    label: string;
    value: string | number;
    unit?: string;
    icon: string;
    color?: string;
    subtext?: string;
  }) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 flex flex-col gap-1.5 min-w-0">
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-slate-500 tracking-[0.08em] uppercase font-mono">
            {label}
          </span>
          <span className="text-lg">{icon}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[28px] font-bold font-mono tracking-tight"
            style={{ color }}
          >
            {value}
          </span>
          {unit && <span className="text-sm text-slate-500">{unit}</span>}
        </div>
        {subtext && <span className="text-[11px] text-slate-500">{subtext}</span>}
      </div>
    );
  }
  
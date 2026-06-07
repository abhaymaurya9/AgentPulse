import clsx from "clsx";
import { ReactNode } from "react";

type ScoreCardProps = {
  title: string;
  value: string | number;
  description?: string;
  color?: "indigo" | "emerald" | "amber" | "rose" | "cyan";
  icon?: ReactNode;
  progress?: number;
};

export default function ScoreCard({ title, value, description, color = "indigo", icon, progress }: ScoreCardProps) {
  const colorMap = {
    indigo: {
      text: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
      glow: "group-hover:border-indigo-500/50",
    },
    emerald: {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      glow: "group-hover:border-emerald-500/50",
    },
    amber: {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      glow: "group-hover:border-amber-500/50",
    },
    rose: {
      text: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      glow: "group-hover:border-rose-500/50",
    },
    cyan: {
      text: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
      glow: "group-hover:border-cyan-500/50",
    },
  };

  const currentColors = colorMap[color];

  return (
    <div className={clsx(
      "group relative overflow-hidden rounded-xl border p-6 bg-gray-900/40 backdrop-blur-sm transition-all duration-300 flex flex-col justify-between h-full",
      currentColors.border,
      currentColors.glow
    )}>
      {/* Decorative Gradient Glow */}
      <div className={clsx(
        "absolute -right-16 -top-16 h-32 w-32 rounded-full blur-3xl opacity-20 transition-opacity duration-300 group-hover:opacity-30",
        currentColors.bg
      )} />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold tracking-wide text-gray-400 uppercase flex items-center gap-2">
          {icon && <span className={clsx(currentColors.text)}>{icon}</span>}
          {title}
        </h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={clsx("text-4xl font-extrabold tracking-tight", currentColors.text)}>
            {value}
          </span>
        </div>
        {description && (
          <p className="mt-2 text-xs text-gray-500 line-clamp-2">
            {description}
          </p>
        )}
      </div>

      {progress !== undefined && (
        <div className="mt-5 space-y-2 pt-2 border-t border-gray-800/40">
          <div className="flex justify-between text-[10px] font-mono text-gray-500">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-950 h-1.5 rounded-full overflow-hidden border border-gray-850">
            <div
              className={clsx("h-full rounded-full transition-all duration-500 ease-out", {
                "bg-indigo-500": color === "indigo",
                "bg-emerald-500": color === "emerald",
                "bg-amber-500": color === "amber",
                "bg-rose-500": color === "rose",
                "bg-cyan-500": color === "cyan",
              })}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

import clsx from "clsx";
import { ReactNode } from "react";

type ScoreCardProps = {
  title: string;
  value: string | number;
  description?: string;
  color?: "primary" | "success" | "warning" | "danger" | "indigo" | "emerald" | "amber" | "rose" | "cyan";
  icon?: ReactNode;
  progress?: number;
  onClick?: () => void;
  isLarge?: boolean;
};

export default function ScoreCard({
  title,
  value,
  description,
  color = "primary",
  icon,
  progress,
  onClick,
  isLarge = false,
}: ScoreCardProps) {
  const colorMap = {
    primary: {
      text: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
      glow: "group-hover:border-primary/40",
      bar: "bg-primary",
      shadow: "hover:shadow-primary/5",
    },
    success: {
      text: "text-success",
      bg: "bg-success/10",
      border: "border-success/20",
      glow: "group-hover:border-success/40",
      bar: "bg-success",
      shadow: "hover:shadow-success/5",
    },
    warning: {
      text: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning/20",
      glow: "group-hover:border-warning/40",
      bar: "bg-warning",
      shadow: "hover:shadow-warning/5",
    },
    danger: {
      text: "text-danger",
      bg: "bg-danger/10",
      border: "border-danger/20",
      glow: "group-hover:border-danger/40",
      bar: "bg-danger",
      shadow: "hover:shadow-danger/5",
    },
    // Legacies mapped for safety
    indigo: {
      text: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
      glow: "group-hover:border-primary/40",
      bar: "bg-primary",
      shadow: "hover:shadow-primary/5",
    },
    emerald: {
      text: "text-success",
      bg: "bg-success/10",
      border: "border-success/20",
      glow: "group-hover:border-success/40",
      bar: "bg-success",
      shadow: "hover:shadow-success/5",
    },
    amber: {
      text: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning/20",
      glow: "group-hover:border-warning/40",
      bar: "bg-warning",
      shadow: "hover:shadow-warning/5",
    },
    rose: {
      text: "text-danger",
      bg: "bg-danger/10",
      border: "border-danger/20",
      glow: "group-hover:border-danger/40",
      bar: "bg-danger",
      shadow: "hover:shadow-danger/5",
    },
    cyan: {
      text: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
      glow: "group-hover:border-primary/40",
      bar: "bg-primary",
      shadow: "hover:shadow-primary/5",
    },
  };

  const currentColors = colorMap[color] || colorMap.primary;

  return (
    <div
      onClick={onClick}
      className={clsx(
        "group relative overflow-hidden rounded-xl border bg-card/40 backdrop-blur-md transition-all duration-300 flex flex-col justify-between shadow-md shadow-black/40",
        isLarge ? "p-8 min-h-[200px]" : "p-6 min-h-[140px]",
        onClick ? "cursor-pointer hover:scale-[1.03] hover:bg-card/60 active:scale-[0.99]" : "hover:scale-[1.01] hover:bg-card/50",
        currentColors.border,
        currentColors.glow,
        currentColors.shadow
      )}
    >
      {/* Decorative Gradient Glow */}
      <div
        className={clsx(
          "absolute -right-16 -top-16 rounded-full blur-3xl opacity-20 transition-opacity duration-500 group-hover:opacity-30 pointer-events-none",
          isLarge ? "h-48 w-48" : "h-32 w-32",
          currentColors.bg
        )}
      />

      <div className="space-y-3">
        {/* Metric Name */}
        <h3
          className={clsx(
            "font-semibold tracking-wider text-gray-400 uppercase flex items-center gap-2",
            isLarge ? "text-sm" : "text-[11px]"
          )}
        >
          {icon && <span className={currentColors.text}>{icon}</span>}
          {title}
        </h3>

        {/* Score Number (Big, center) */}
        <div className={clsx("flex items-baseline gap-1.5", isLarge ? "mt-4" : "mt-2")}>
          <span
            className={clsx(
              "font-black tracking-tight",
              isLarge ? "text-5xl md:text-6xl text-white" : "text-3xl md:text-4xl",
              !isLarge && currentColors.text
            )}
          >
            {value}
          </span>
          {isLarge && typeof value === "string" && !isNaN(Number(value)) && (
            <span className="text-gray-400 text-lg md:text-xl font-medium">/100</span>
          )}
          {isLarge && typeof value === "number" && (
            <span className="text-gray-400 text-lg md:text-xl font-medium">/100</span>
          )}
        </div>

        {description && (
          <p className={clsx("text-gray-400 leading-relaxed", isLarge ? "text-xs mt-3 max-w-xl" : "text-[11px] mt-1.5 line-clamp-2")}>
            {description}
          </p>
        )}
      </div>

      {/* Progress Bar (Bottom) */}
      {progress !== undefined && (
        <div className={clsx("space-y-1.5 pt-3 border-t border-gray-800/60", isLarge ? "mt-8" : "mt-5")}>
          <div className="flex justify-between text-[10px] font-mono text-gray-500">
            <span>Score weight</span>
            <span className={clsx("font-bold", currentColors.text)}>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-950 h-2 rounded-full overflow-hidden border border-gray-800/40">
            <div
              className={clsx("h-full rounded-full transition-all duration-700 ease-out", currentColors.bar)}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

import { ShieldAlert, ShieldCheck } from "lucide-react";
import clsx from "clsx";

type DriftBadgeProps = {
  driftDetected: boolean;
  size?: "sm" | "md";
};

export default function DriftBadge({ driftDetected, size = "md" }: DriftBadgeProps) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide uppercase transition-all duration-300",
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
      driftDetected
        ? "bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-sm shadow-rose-500/10 animate-pulse"
        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10"
    )}>
      {driftDetected ? (
        <>
          <ShieldAlert className={clsx(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
          Drift Detected
        </>
      ) : (
        <>
          <ShieldCheck className={clsx(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
          Healthy
        </>
      )}
    </span>
  );
}

"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";

function parseUTCDate(dateStr: string | undefined | null): Date {
  if (!dateStr) return new Date();
  return new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
}

type EvalRun = {
  run_date: string;
  composite_score: number;
  faithfulness_score: number;
  context_precision: number;
  context_recall: number;
  answer_quality: number;
  drift_detected: boolean;
};

type EvolutionGraphProps = {
  data: EvalRun[];
  agentName?: string;
};

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: {
    drift_detected?: boolean;
  };
  activeMetricColor?: string;
  index?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    payload?: {
      drift_detected?: boolean;
      composite_score?: number;
      faithfulness_score?: number;
      context_precision?: number;
      context_recall?: number;
    };
    value?: number | string;
    name?: string;
  }[];
  label?: string;
}

type MetricKey = "composite_score" | "faithfulness_score" | "context_precision" | "context_recall";

const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: "composite_score", label: "Composite Score", color: "#3b82f6" },
  { key: "faithfulness_score", label: "Faithfulness", color: "#10b981" },
  { key: "context_precision", label: "Context Precision", color: "#f59e0b" },
  { key: "context_recall", label: "Context Recall", color: "#06b6d4" },
];

// Custom dot renderer: red & large for drift, normal otherwise
function CustomDot(props: CustomDotProps) {
  const { cx, cy, payload, activeMetricColor } = props;
  if (!cx || !cy) return null;

  if (payload?.drift_detected) {
    return (
      <g>
        {/* Outer glow ring */}
        <circle cx={cx} cy={cy} r={10} fill="rgba(239,68,68,0.15)" stroke="none" />
        {/* Red dot */}
        <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#991b1b" strokeWidth={2} />
      </g>
    );
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="#111827"
      stroke={activeMetricColor}
      strokeWidth={2}
    />
  );
}

// Custom active dot (hover)
function CustomActiveDot(props: CustomDotProps) {
  const { cx, cy, payload, activeMetricColor } = props;
  if (!cx || !cy) return null;

  if (payload?.drift_detected) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={12} fill="rgba(239,68,68,0.2)" stroke="none" />
        <circle cx={cx} cy={cy} r={7} fill="#ef4444" stroke="#fca5a5" strokeWidth={2} />
      </g>
    );
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={activeMetricColor}
      stroke="#fff"
      strokeWidth={2}
    />
  );
}

// Custom tooltip with drift warning
function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-card border border-gray-700/60 rounded-xl p-4 shadow-xl text-xs space-y-3 min-w-[210px] backdrop-blur-md">
      <div className="text-gray-400 font-bold uppercase tracking-wider pb-1.5 border-b border-gray-800">
        {label}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center gap-4">
          <span className="text-gray-400 font-medium flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
            Composite Score
          </span>
          <span className="text-white font-extrabold font-mono">
            {data.composite_score !== undefined && typeof data.composite_score === "number" ? data.composite_score.toFixed(2) : "N/A"}
          </span>
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-gray-400 font-medium flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#10b981]" />
            Faithfulness
          </span>
          <span className="text-white font-extrabold font-mono">
            {data.faithfulness_score !== undefined && typeof data.faithfulness_score === "number" ? data.faithfulness_score.toFixed(1) : "N/A"}%
          </span>
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-gray-400 font-medium flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
            Context Precision
          </span>
          <span className="text-white font-extrabold font-mono">
            {data.context_precision !== undefined && typeof data.context_precision === "number" ? data.context_precision.toFixed(1) : "N/A"}%
          </span>
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-gray-400 font-medium flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#06b6d4]" />
            Context Recall
          </span>
          <span className="text-white font-extrabold font-mono">
            {data.context_recall !== undefined && typeof data.context_recall === "number" ? data.context_recall.toFixed(1) : "N/A"}%
          </span>
        </div>
      </div>
      {data.drift_detected && (
        <div className="flex items-center gap-1.5 text-danger font-bold pt-2 border-t border-gray-800">
          <span>⚠️</span>
          <span>Drift Detected</span>
        </div>
      )}
    </div>
  );
}

export default function EvolutionGraph({ data, agentName }: EvolutionGraphProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("composite_score");

  const activeMetricConfig = METRICS.find((m) => m.key === activeMetric)!;

  // Format data: reverse to chronological order, normalize 0-1 scores to 0-100 for non-composite
  const formattedData = [...data].reverse().map((run, index) => {
    const isRatio = (v: number) => v >= 0 && v <= 1;

    return {
      ...run,
      displayDate: parseUTCDate(run.run_date).toLocaleDateString('en-US', {
        timeZone: 'Asia/Kolkata',
        month: "short",
        day: "numeric",
      }),
      runLabel: `Run ${index + 1}`,
      // Normalize faithfulness, precision, recall (0-1 → 0-100) for chart scale
      faithfulness_score: isRatio(run.faithfulness_score)
        ? run.faithfulness_score * 100
        : run.faithfulness_score,
      context_precision: isRatio(run.context_precision)
        ? run.context_precision * 100
        : run.context_precision,
      context_recall: isRatio(run.context_recall)
        ? run.context_recall * 100
        : run.context_recall,
    };
  });

  if (formattedData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-gray-800 bg-gray-950/20 text-sm text-gray-500">
        No evaluation run data found. Run evaluations to populate the graph.
      </div>
    );
  }

  return (
    <div className="w-full bg-card border border-gray-800/60 p-6 rounded-xl space-y-5 shadow-lg shadow-black/40">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-md font-bold text-gray-200 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-400" />
          {agentName ? `${agentName} — Performance Evolution` : "Performance Evolution"}
        </h3>

        {/* Metric Toggle Buttons */}
        <div className="flex flex-wrap gap-2">
          {METRICS.map((metric) => (
            <button
              key={metric.key}
              onClick={() => setActiveMetric(metric.key)}
              className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                activeMetric === metric.key
                  ? "text-white border-transparent shadow-md"
                  : "text-gray-400 border-gray-800 hover:border-gray-700 hover:text-white bg-transparent"
              }`}
              style={
                activeMetric === metric.key
                  ? { backgroundColor: metric.color + "22", borderColor: metric.color + "55", color: metric.color }
                  : undefined
              }
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData} margin={{ top: 10, right: 20, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="displayDate"
              stroke="#6b7280"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#1f2937" }}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#6b7280"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#1f2937" }}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#374151", strokeDasharray: "4 4" }} />

            {/* Minimum threshold reference line at Y=50 */}
            <ReferenceLine
              y={50}
              stroke="#ef4444"
              strokeDasharray="6 4"
              strokeOpacity={0.5}
              label={{
                value: "Minimum threshold",
                position: "insideTopRight",
                fill: "#ef4444",
                fontSize: 10,
                fontWeight: 600,
                opacity: 0.7,
              }}
            />

            {/* Active metric line */}
            <Line
              type="monotone"
              dataKey={activeMetric}
              name={activeMetricConfig.label}
              stroke={activeMetricConfig.color}
              strokeWidth={3}
              dot={(dotProps: CustomDotProps) => (
                <CustomDot
                  key={`dot-${dotProps.index}`}
                  {...dotProps}
                  activeMetricColor={activeMetricConfig.color}
                />
              )}
              activeDot={(dotProps: CustomDotProps) => (
                <CustomActiveDot
                  key={`activedot-${dotProps.index}`}
                  {...dotProps}
                  activeMetricColor={activeMetricConfig.color}
                />
              )}
              animationDuration={600}
              animationEasing="ease-in-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-[10px] text-gray-500 uppercase tracking-wider pt-2 border-t border-gray-900">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeMetricConfig.color }} />
          <span>{activeMetricConfig.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500 border border-red-800" />
          <span>Drift Detected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t-2 border-dashed border-red-500/50" />
          <span>Minimum threshold (50)</span>
        </div>
      </div>
    </div>
  );
}

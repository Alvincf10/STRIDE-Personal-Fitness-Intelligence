"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function DistanceTrendChart({
  data,
  unit = "km",
}: {
  data: Array<{ weekStart: string; distanceMeters: number }>;
  unit?: "km" | "mi";
}) {
  const chartData = data.map((d) => ({
    week: d.weekStart.slice(5),
    distance:
      unit === "km" ? d.distanceMeters / 1000 : d.distanceMeters / 1609.344,
  }));

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">No weekly distance yet.</p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="distanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B8FF3C" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#B8FF3C" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="week" stroke="#8FA89A" fontSize={12} tickLine={false} />
          <YAxis stroke="#8FA89A" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: "#15261E",
              border: "1px solid #243C31",
              borderRadius: 12,
            }}
            formatter={(value) => [
              `${Number(value).toFixed(2)} ${unit}`,
              "Distance",
            ]}
          />
          <Area
            type="monotone"
            dataKey="distance"
            stroke="#B8FF3C"
            strokeWidth={2.5}
            fill="url(#distanceFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getNetProfitBarColor } from "@/lib/profit-visuals";

export function ProfitChart({ points }: { points: Array<{ date: string; netProfit: number }> }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="netProfit" radius={4}>
            {points.map((point) => (
              <Cell key={`${point.date}-${point.netProfit}`} fill={getNetProfitBarColor(point.netProfit)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

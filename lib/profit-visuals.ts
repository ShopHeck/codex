export type NetProfitVisualState = "profit" | "loss" | "breakeven";

export function formatWaterfallTotal(netProfit: number): string {
  const absoluteValue = Math.abs(netProfit).toFixed(2);
  return netProfit < 0 ? `-$${absoluteValue}` : `$${absoluteValue}`;
}

export function getNetProfitVisualState(netProfit: number): NetProfitVisualState {
  if (netProfit < 0) return "loss";
  if (netProfit > 0) return "profit";
  return "breakeven";
}

export function getNetProfitBarColor(netProfit: number): string {
  const state = getNetProfitVisualState(netProfit);
  if (state === "loss") return "#dc2626";
  if (state === "profit") return "#16a34a";
  return "#6b7280";
}

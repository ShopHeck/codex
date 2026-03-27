"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type FirstRevealData = {
  kpis: {
    revenue: number;
    netProfit: number;
    revenueProfitGap: number;
  };
  products: Array<{
    productId: string;
    productTitle: string;
    netProfit: number;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export default function OnboardingPage() {
  const [revealData, setRevealData] = useState<FirstRevealData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingReveal, setIsLoadingReveal] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  async function loadFirstReveal() {
    setError(null);
    setIsLoadingReveal(true);
    try {
      const dashboardRes = await fetch("/api/dashboard");
      if (!dashboardRes.ok) {
        throw new Error("Failed to load your first reveal insights.");
      }

      const dashboardData = (await dashboardRes.json()) as FirstRevealData;
      setRevealData(dashboardData);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Could not load first reveal data.";
      setError(message);
    } finally {
      setIsLoadingReveal(false);
    }
  }

  async function completeOnboarding() {
    setError(null);
    setIsCompleting(true);
    try {
      const response = await fetch("/api/onboarding", { method: "POST" });
      if (!response.ok) {
        throw new Error("We could not complete setup. Please try again.");
      }

      window.location.href = "/dashboard";
    } catch (postError) {
      const message = postError instanceof Error ? postError.message : "Could not finish setup.";
      setError(message);
    } finally {
      setIsCompleting(false);
    }
  }

  const topProfitable = revealData?.products.filter((product) => product.netProfit > 0).slice(0, 3) ?? [];
  const topDestroying = revealData?.products
    .filter((product) => product.netProfit < 0)
    .sort((a, b) => a.netProfit - b.netProfit)
    .slice(0, 3) ?? [];

  return (
    <main className="p-6">
      <Card className="space-y-4 p-6">
        <h1 className="text-xl font-semibold">Welcome to Real Profit for Shopify</h1>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>We read orders, refunds, and products to compute true net profit.</li>
          <li>You can configure COGS, fee assumptions, shipping costs, and ad spend.</li>
          <li>Billing is handled only through Shopify billing approvals.</li>
        </ul>

        <div className="flex flex-wrap gap-3">
          <Button onClick={loadFirstReveal} disabled={isLoadingReveal}>
            {isLoadingReveal ? "Loading first reveal..." : "Reveal first insights"}
          </Button>
          <Button onClick={completeOnboarding} disabled={isCompleting} className="bg-slate-900 text-white hover:bg-slate-800">
            {isCompleting ? "Finishing setup..." : "Finish setup"}
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {revealData && (
          <div className="space-y-4 rounded border p-4">
            <p className="text-sm font-medium">First Reveal</p>
            <p className="text-sm text-muted-foreground">
              You made {formatCurrency(revealData.kpis.revenue)} in revenue and {formatCurrency(revealData.kpis.netProfit)} in net profit.
              Gap: {formatCurrency(revealData.kpis.revenueProfitGap)}.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1 text-sm font-medium">Top Profitable Products</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {topProfitable.map((product) => (
                    <li key={product.productId}>
                      {product.productTitle}: {formatCurrency(product.netProfit)}
                    </li>
                  ))}
                  {topProfitable.length === 0 && <li>No profitable products yet.</li>}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Top Losing Products</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {topDestroying.map((product) => (
                    <li key={product.productId}>
                      {product.productTitle}: {formatCurrency(product.netProfit)}
                    </li>
                  ))}
                  {topDestroying.length === 0 && <li>No products currently losing money.</li>}
                </ul>
              </div>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}

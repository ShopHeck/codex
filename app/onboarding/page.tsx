"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Recommendation = {
  title: string;
  summary: string;
  estimatedMonthlyImpact: number;
};

type Product = {
  productId: string;
  productTitle: string;
  netProfit: number;
};

type RevealData = {
  revenue: number;
  netProfit: number;
  gap: number;
  losingProducts: Product[];
  recommendations: Recommendation[];
};

const steps = [
  { key: "welcome", label: "Welcome" },
  { key: "sync-progress", label: "Sync progress" },
  { key: "cost-setup", label: "Cost setup" },
  { key: "profit-mode", label: "Profit mode" },
  { key: "first-reveal", label: "First reveal" }
] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export default function OnboardingPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingCosts, setIsSavingCosts] = useState(false);
  const [isLoadingReveal, setIsLoadingReveal] = useState(false);
  const [profitMode, setProfitMode] = useState<"balanced" | "strict">("balanced");
  const [costForm, setCostForm] = useState({
    paymentFeePercent: "2.9",
    shopifyFeePercent: "0.5",
    defaultShippingCost: "6.5"
  });
  const [syncDone, setSyncDone] = useState(false);
  const [costSaved, setCostSaved] = useState(false);
  const [revealData, setRevealData] = useState<RevealData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentStep = steps[stepIndex];

  const headline = useMemo(() => {
    if (!revealData) return null;
    return `You made ${formatCurrency(revealData.revenue)} in revenue but only ${formatCurrency(revealData.netProfit)} in profit.`;
  }, [revealData]);

  async function runSync() {
    setError(null);
    setIsSyncing(true);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      if (!response.ok) throw new Error("Sync failed. Please try again.");
      setSyncDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync right now.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function saveCosts() {
    setError(null);
    setIsSavingCosts(true);
    try {
      const formData = new FormData();
      formData.append("paymentFeePercent", costForm.paymentFeePercent);
      formData.append("shopifyFeePercent", costForm.shopifyFeePercent);
      formData.append("defaultShippingCost", costForm.defaultShippingCost);

      const response = await fetch("/api/settings", {
        method: "POST",
        body: formData,
        redirect: "manual"
      });

      if (!(response.ok || response.status === 0)) {
        throw new Error("Could not save costs. Please check the fields.");
      }

      setCostSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save costs right now.");
    } finally {
      setIsSavingCosts(false);
    }
  }

  async function loadFirstReveal() {
    setError(null);
    setIsLoadingReveal(true);
    try {
      const [dashboardRes, productsRes] = await Promise.all([fetch("/api/dashboard"), fetch("/api/products")]);
      if (!dashboardRes.ok || !productsRes.ok) {
        throw new Error("Could not load your first reveal yet.");
      }

      const dashboard = await dashboardRes.json();
      const products = await productsRes.json();
      const losingProducts = (products.products as Product[])
        .filter((product) => product.netProfit < 0)
        .sort((a, b) => a.netProfit - b.netProfit)
        .slice(0, 3);

      const recommendations = (dashboard.recommendations as Recommendation[]).slice(0, 3);

      setRevealData({
        revenue: dashboard.kpis.revenue,
        netProfit: dashboard.kpis.netProfit,
        gap: dashboard.kpis.revenueProfitGap,
        losingProducts,
        recommendations
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reveal data.");
    } finally {
      setIsLoadingReveal(false);
    }
  }

  async function completeOnboarding() {
    await fetch("/api/onboarding", { method: "POST" });
    window.location.href = "/dashboard";
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <Card className="p-6">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          {steps.map((step, index) => (
            <div
              key={step.key}
              className={`rounded-full border px-3 py-1 ${
                index === stepIndex
                  ? "border-primary bg-primary/10 text-primary"
                  : index < stepIndex
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "text-muted-foreground"
              }`}
            >
              {index + 1}. {step.label}
            </div>
          ))}
        </div>

        {currentStep.key === "welcome" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Welcome to Real Profit AI</h1>
            <p className="text-sm text-muted-foreground">
              We will get you to your first profit insight quickly: sync data, set basic costs, choose a profit mode, and reveal where money is leaking.
            </p>
          </div>
        )}

        {currentStep.key === "sync-progress" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Sync progress</h1>
            <p className="text-sm text-muted-foreground">Pull your latest Shopify orders and rebuild profit snapshots.</p>
            <Button onClick={runSync} disabled={isSyncing}>{isSyncing ? "Syncing..." : "Start sync"}</Button>
            {syncDone && <p className="text-sm text-emerald-700">Sync complete. Your store data is ready.</p>}
          </div>
        )}

        {currentStep.key === "cost-setup" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Cost setup</h1>
            <p className="text-sm text-muted-foreground">Use quick defaults now. You can refine details in Settings anytime.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Payment fee %</span>
                <input
                  className="w-full rounded-md border p-2"
                  value={costForm.paymentFeePercent}
                  onChange={(event) => setCostForm((prev) => ({ ...prev, paymentFeePercent: event.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Shopify fee %</span>
                <input
                  className="w-full rounded-md border p-2"
                  value={costForm.shopifyFeePercent}
                  onChange={(event) => setCostForm((prev) => ({ ...prev, shopifyFeePercent: event.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Default shipping cost</span>
                <input
                  className="w-full rounded-md border p-2"
                  value={costForm.defaultShippingCost}
                  onChange={(event) => setCostForm((prev) => ({ ...prev, defaultShippingCost: event.target.value }))}
                />
              </label>
            </div>
            <Button onClick={saveCosts} disabled={isSavingCosts}>{isSavingCosts ? "Saving..." : "Save cost defaults"}</Button>
            {costSaved && <p className="text-sm text-emerald-700">Cost defaults saved.</p>}
          </div>
        )}

        {currentStep.key === "profit-mode" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Profit mode</h1>
            <p className="text-sm text-muted-foreground">Choose how strict you want your first pass to be.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={`rounded-lg border p-4 text-left ${profitMode === "balanced" ? "border-primary bg-primary/5" : ""}`}
                onClick={() => setProfitMode("balanced")}
              >
                <p className="font-medium">Balanced mode</p>
                <p className="text-sm text-muted-foreground">Best for fast onboarding with sensible defaults.</p>
              </button>
              <button
                type="button"
                className={`rounded-lg border p-4 text-left ${profitMode === "strict" ? "border-primary bg-primary/5" : ""}`}
                onClick={() => setProfitMode("strict")}
              >
                <p className="font-medium">Strict mode</p>
                <p className="text-sm text-muted-foreground">Emphasize conservative profit assumptions.</p>
              </button>
            </div>
          </div>
        )}

        {currentStep.key === "first-reveal" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">First reveal</h1>
            <p className="text-sm text-muted-foreground">See your first true-profit snapshot.</p>
            <Button onClick={loadFirstReveal} disabled={isLoadingReveal}>{isLoadingReveal ? "Loading reveal..." : "Generate first reveal"}</Button>

            {revealData && (
              <div className="space-y-4">
                <Card className="border-primary/20 bg-primary/5 p-4">
                  <p className="font-medium">{headline}</p>
                </Card>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Card className="p-4">
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="text-2xl font-semibold">{formatCurrency(revealData.revenue)}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-sm text-muted-foreground">Real profit</p>
                    <p className="text-2xl font-semibold">{formatCurrency(revealData.netProfit)}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-sm text-muted-foreground">Revenue vs profit gap</p>
                    <p className="text-2xl font-semibold">{formatCurrency(revealData.gap)}</p>
                  </Card>
                </div>

                <Card className="p-4">
                  <h2 className="font-medium">Top 3 losing products</h2>
                  <ul className="mt-2 space-y-2 text-sm">
                    {revealData.losingProducts.map((product) => (
                      <li key={product.productId} className="flex items-center justify-between rounded border p-2">
                        <span>{product.productTitle}</span>
                        <span className="text-red-600">{formatCurrency(product.netProfit)}</span>
                      </li>
                    ))}
                    {revealData.losingProducts.length === 0 && (
                      <li className="rounded border p-2 text-muted-foreground">No losing products found in current data.</li>
                    )}
                  </ul>
                </Card>

                <Card className="p-4">
                  <h2 className="font-medium">3 recommendations</h2>
                  <ul className="mt-2 space-y-2 text-sm">
                    {revealData.recommendations.map((recommendation) => (
                      <li key={recommendation.title} className="rounded border p-3">
                        <p className="font-medium">{recommendation.title}</p>
                        <p className="text-muted-foreground">{recommendation.summary}</p>
                        <p className="mt-1 text-emerald-700">
                          Est. impact: {formatCurrency(recommendation.estimatedMonthlyImpact)}/month
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <Button
            type="button"
            className="bg-slate-200 text-slate-900"
            onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
            disabled={stepIndex === 0}
          >
            Back
          </Button>

          {stepIndex < steps.length - 1 ? (
            <Button type="button" onClick={() => setStepIndex((index) => Math.min(steps.length - 1, index + 1))}>
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={completeOnboarding}>Finish setup</Button>
          )}
        </div>
      </Card>
    </main>
  );
}

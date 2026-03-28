import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings & Billing</h1>
      <Card className="p-4 space-y-3">
        <h2 className="font-medium">Fee assumptions</h2>
        <form action="/api/settings" method="post" className="grid gap-2 md:grid-cols-3">
          <input className="border rounded p-2" name="paymentFeePercent" placeholder="Payment fee %" />
          <input className="border rounded p-2" name="shopifyFeePercent" placeholder="Shopify fee %" />
          <input className="border rounded p-2" name="defaultShippingCost" placeholder="Shipping $" />
          <Button type="submit" className="md:col-span-3">Save assumptions</Button>
        </form>
      </Card>
      <Card className="p-4">
        <h2 className="font-medium">Subscription</h2>
        <p className="text-sm text-muted-foreground mb-2">Current plan: Starter (managed by Shopify Billing API)</p>
        <a className="text-blue-600 underline" href="/api/billing/confirm?manage=true">Manage subscription in Shopify</a>
      </Card>
    </div>
  );
}

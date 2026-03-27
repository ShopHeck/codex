import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  return (
    <main className="p-6">
      <Card className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Welcome to Real Profit for Shopify</h1>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>We read orders, refunds, and products to compute true net profit.</li>
          <li>You can configure COGS, fee assumptions, shipping costs, and ad spend.</li>
          <li>Billing is handled only through Shopify billing approvals.</li>
        </ul>
        <a href="/dashboard">
          <Button>Finish setup</Button>
        </a>
      </Card>
    </main>
  );
}

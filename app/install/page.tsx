import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InstallPage() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="max-w-xl w-full p-8 space-y-4">
        <h1 className="text-2xl font-semibold">Install Real Profit for Shopify</h1>
        <p className="text-sm text-muted-foreground">
          Enter your shop domain to start Shopify OAuth and install the embedded app.
        </p>
        <form action="/api/auth/start" method="get" className="space-y-3">
          <input
            className="w-full rounded-md border p-2"
            type="text"
            name="shop"
            placeholder="example-shop.myshopify.com"
            required
          />
          <Button type="submit" className="w-full">Continue with Shopify</Button>
        </form>
      </Card>
    </main>
  );
}

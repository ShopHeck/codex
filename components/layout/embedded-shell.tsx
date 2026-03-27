import type { ReactNode } from "react";
import Link from "next/link";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
  { href: "/products", label: "Products" },
  { href: "/leaks", label: "Leaks" },
  { href: "/actions", label: "Actions" },
  { href: "/settings", label: "Settings" }
];

export function EmbeddedShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-3 font-semibold">Real Profit for Shopify</header>
      <div className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border bg-white p-3">
          <nav className="space-y-1 text-sm">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded px-3 py-2 hover:bg-gray-100">
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}

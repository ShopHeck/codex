import type { ReactNode } from "react";
import "./globals.css";
import type { Metadata } from "next";
import { validateConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Real Profit for Shopify",
  description: "Embedded Shopify app for true net profit analytics"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  validateConfig();

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

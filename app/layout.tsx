import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Real Profit for Shopify",
  description: "Embedded Shopify app for true net profit analytics"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

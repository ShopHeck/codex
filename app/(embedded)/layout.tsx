import type { ReactNode } from "react";
import { EmbeddedShell } from "@/components/layout/embedded-shell";

export default function EmbeddedLayout({ children }: { children: ReactNode }) {
  return <EmbeddedShell>{children}</EmbeddedShell>;
}

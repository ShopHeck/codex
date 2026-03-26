import { EmbeddedShell } from "@/components/layout/embedded-shell";

export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  return <EmbeddedShell>{children}</EmbeddedShell>;
}

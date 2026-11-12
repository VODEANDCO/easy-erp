import { AppShell } from "@/components/layout/app-shell";
import { isPreviewMode } from "@/features/products/queries";
import { isProductsDemoMode } from "@/lib/auth/business-access";

export default function ErpLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell preview={isPreviewMode()} demo={isProductsDemoMode()}>
      {children}
    </AppShell>
  );
}

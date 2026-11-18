import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/toast";
import { isPreviewMode } from "@/features/products/queries";
import { isProductsDemoMode } from "@/lib/auth/business-access";

export default function ErpLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell preview={isPreviewMode()} demo={isProductsDemoMode()}>
      {children}
      <Toaster />
    </AppShell>
  );
}

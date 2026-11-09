import { AppShell } from "@/components/layout/app-shell";
import { isPreviewMode } from "@/features/products/queries";

export default function ErpLayout({ children }: LayoutProps<"/">) {
  return <AppShell preview={isPreviewMode()}>{children}</AppShell>;
}

import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import { ShopProvider } from "@/hooks/useShop";

export function DashboardLayout() {
  return (
    <ShopProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <DashboardSidebar />
          <SidebarInset className="flex-1">
            <header className="h-14 flex items-center gap-4 border-b border-border px-4 bg-background/95 backdrop-blur sticky top-0 z-10">
              <SidebarTrigger />
            </header>
            <main className="flex-1 p-6">
              <Outlet />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ShopProvider>
  );
}

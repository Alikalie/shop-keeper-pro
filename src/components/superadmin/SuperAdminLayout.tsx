import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { useAuth } from "@/hooks/useAuth";

export function SuperAdminLayout() {
  const { isSuperAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SuperAdminSidebar />
        <SidebarInset className="flex-1">
          <header className="h-14 flex items-center gap-4 border-b border-border px-4 bg-primary/5 sticky top-0 z-10">
            <SidebarTrigger />
            <span className="text-sm font-semibold text-primary">ABAF-SHOP Super Admin</span>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

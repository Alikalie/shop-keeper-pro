import { useEffect, useMemo, useState } from "react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Package, ShoppingCart, Users, FileText, Settings,
  UserCog, LogOut, Store, FolderOpen, TrendingUp, CreditCard, Mail, MessageCircle, ShieldCheck, User, ArrowDownUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const mainNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Point of Sale", url: "/dashboard/pos", icon: ShoppingCart },
  { title: "Products", url: "/dashboard/products", icon: Package },
  { title: "Categories", url: "/dashboard/categories", icon: FolderOpen },
  { title: "Customers", url: "/dashboard/customers", icon: Users },
  { title: "Sales History", url: "/dashboard/sales", icon: FileText },
  { title: "Loans", url: "/dashboard/loans", icon: CreditCard },
  { title: "Change Owed", url: "/dashboard/overpayments", icon: ArrowDownUp },
];

const adminNavItems = [
  { title: "Reports", url: "/dashboard/reports", icon: TrendingUp },
  { title: "Staff Performance", url: "/dashboard/staff-performance", icon: Users },
  { title: "User Management", url: "/dashboard/users", icon: UserCog },
  { title: "Shop Settings", url: "/dashboard/settings", icon: Settings },
];

export function DashboardSidebar() {
  const { signOut, isSuperAdmin } = useAuth();
  const { shop, isOwner } = useShop();
  const { state } = useSidebar();
  const [pendingOverpayments, setPendingOverpayments] = useState(0);
  const collapsed = state === "collapsed";

  useEffect(() => {
    const fetchPendingOverpayments = async () => {
      if (!shop?.id) {
        setPendingOverpayments(0);
        return;
      }

      const { count, error } = await supabase
        .from("overpayments")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id)
        .eq("status", "pending");

      if (!error) {
        setPendingOverpayments(count || 0);
      }
    };

    fetchPendingOverpayments();

    if (!shop?.id) return;

    const channel = supabase
      .channel(`overpayments-sidebar-${shop.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "overpayments", filter: `shop_id=eq.${shop.id}` },
        () => fetchPendingOverpayments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shop?.id]);

  const navItems = useMemo(
    () => mainNavItems.map((item) => ({
      ...item,
      badge: item.url === "/dashboard/overpayments" && pendingOverpayments > 0 ? pendingOverpayments : null,
    })),
    [pendingOverpayments]
  );

  const handleEmailSupport = () => {
    window.location.href = "mailto:support@abafshop.com?subject=ABAF-SHOP Support Request";
  };

  const handleWhatsAppSupport = () => {
    window.open("https://wa.me/23200000000?text=Hi, I need help with ABAF-SHOP", "_blank");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
            <Store className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="truncate font-bold text-sidebar-foreground">{shop?.name || "ABAF-SHOP"}</span>
              <span className="text-xs text-sidebar-foreground/60">{isOwner ? "Owner" : "Staff"}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                      {!collapsed && item.badge ? (
                        <Badge variant="secondary" className="ml-auto min-w-5 justify-center px-1.5 text-xs">
                          {item.badge}
                        </Badge>
                      ) : null}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isOwner && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink to={item.url} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {isSuperAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Super Admin Panel">
                <NavLink to="/superadmin" className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {!collapsed && <span className="font-medium text-primary">Admin Panel</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Email Support">
              <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={handleEmailSupport}>
                <Mail className="h-4 w-4" />
                {!collapsed && <span>Email Support</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="WhatsApp Support">
              <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={handleWhatsAppSupport}>
                <MessageCircle className="h-4 w-4" />
                {!collapsed && <span>WhatsApp Support</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="My Profile">
              <NavLink to="/dashboard/profile" className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent font-medium">
                <User className="h-4 w-4" />
                {!collapsed && <span>My Profile</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Sign Out">
              <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
                <LogOut className="h-4 w-4" />
                {!collapsed && <span>Sign Out</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

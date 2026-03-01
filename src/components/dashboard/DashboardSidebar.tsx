import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Package, ShoppingCart, Users, FileText, Settings,
  UserCog, Globe, LogOut, Store, FolderOpen, TrendingUp, CreditCard, Mail, MessageCircle, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const mainNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Point of Sale", url: "/dashboard/pos", icon: ShoppingCart },
  { title: "Products", url: "/dashboard/products", icon: Package },
  { title: "Categories", url: "/dashboard/categories", icon: FolderOpen },
  { title: "Customers", url: "/dashboard/customers", icon: Users },
  { title: "Sales History", url: "/dashboard/sales", icon: FileText },
  { title: "Loans", url: "/dashboard/loans", icon: CreditCard },
];

const adminNavItems = [
  { title: "Reports", url: "/dashboard/reports", icon: TrendingUp },
  { title: "User Management", url: "/dashboard/users", icon: UserCog },
  { title: "Shop Settings", url: "/dashboard/settings", icon: Settings },
];

export function DashboardSidebar() {
  const { signOut, isSuperAdmin } = useAuth();
  const { shop, isOwner } = useShop();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Store className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-sidebar-foreground truncate">{shop?.name || "ABAF-SHOP"}</span>
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
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === "/dashboard"} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
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
                  {!collapsed && <span className="text-primary font-medium">Admin Panel</span>}
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

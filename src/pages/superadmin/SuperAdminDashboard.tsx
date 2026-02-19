import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Store, Users, ShoppingCart, CreditCard, TrendingUp, DollarSign } from "lucide-react";

interface PlatformStats {
  totalShops: number;
  totalUsers: number;
  totalSales: number;
  totalRevenue: number;
  totalLoans: number;
  totalLoanBalance: number;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats>({
    totalShops: 0,
    totalUsers: 0,
    totalSales: 0,
    totalRevenue: 0,
    totalLoans: 0,
    totalLoanBalance: 0,
  });
  const [recentShops, setRecentShops] = useState<{ id: string; name: string; owner_id: string; plan_type: string; created_at: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [shopsRes, salesRes, loansRes, rolesRes] = await Promise.all([
        supabase.from("shops").select("id, name, owner_id, plan_type, created_at").order("created_at", { ascending: false }),
        supabase.from("sales").select("total_amount"),
        supabase.from("loans").select("total_amount, amount_paid, status").neq("status", "paid"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }),
      ]);

      const totalRevenue = (salesRes.data || []).reduce((s, r) => s + Number(r.total_amount), 0);
      const totalLoanBalance = (loansRes.data || []).reduce((s, r) => s + (Number(r.total_amount) - Number(r.amount_paid || 0)), 0);

      setStats({
        totalShops: shopsRes.data?.length || 0,
        totalUsers: rolesRes.count || 0,
        totalSales: salesRes.data?.length || 0,
        totalRevenue,
        totalLoans: loansRes.data?.length || 0,
        totalLoanBalance,
      });

      setRecentShops((shopsRes.data || []).slice(0, 8));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Super Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform-wide overview and management</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shops</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalShops}</div>
            <p className="text-xs text-muted-foreground">Registered shops on platform</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Owners + staff across all shops</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Transactions across all shops</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">Le {stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total GMV across all shops</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <CreditCard className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLoans}</div>
            <p className="text-xs text-muted-foreground">Outstanding across all shops</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loan Balance</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">Le {stats.totalLoanBalance.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Outstanding credit owed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recently Registered Shops</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentShops.map((shop) => (
              <div key={shop.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Store className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{shop.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{shop.plan_type} plan</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {shop.created_at ? new Date(shop.created_at).toLocaleDateString() : "N/A"}
                </span>
              </div>
            ))}
            {recentShops.length === 0 && (
              <p className="text-muted-foreground text-center py-4">No shops registered yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

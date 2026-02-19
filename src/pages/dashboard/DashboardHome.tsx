import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useShop } from "@/hooks/useShop";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  TrendingUp,
  FileText,
  Download,
} from "lucide-react";
import { generateDailyReportPDF, downloadPDF } from "@/lib/pdf";
import { format } from "date-fns";

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  totalCustomers: number;
  lowStockCount: number;
  cashSales: number;
  creditSales: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  quantity_on_hand: number;
  low_stock_level: number;
}

export default function DashboardHome() {
  const { shop, isOwner, loading: shopLoading } = useShop();
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayTransactions: 0,
    totalCustomers: 0,
    lowStockCount: 0,
    cashSales: 0,
    creditSales: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shop) {
      fetchDashboardData();
    }
  }, [shop]);

  const fetchDashboardData = async () => {
    if (!shop) return;

    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      // Fetch today's sales
      const { data: salesData } = await supabase
        .from("sales")
        .select("total_amount, payment_type")
        .eq("shop_id", shop.id)
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay);

      const todaySales = salesData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;
      const cashSales = salesData?.filter(s => s.payment_type === "cash").reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;
      const creditSales = salesData?.filter(s => s.payment_type === "credit").reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;

      // Fetch customers count
      const { count: customersCount } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", shop.id);

      // Fetch low stock products
      const { data: lowStock } = await supabase
        .from("products")
        .select("id, name, quantity_on_hand, low_stock_level")
        .eq("shop_id", shop.id)
        .filter("quantity_on_hand", "lte", "low_stock_level");

      setStats({
        todaySales,
        todayTransactions: salesData?.length || 0,
        totalCustomers: customersCount || 0,
        lowStockCount: lowStock?.length || 0,
        cashSales,
        creditSales,
      });

      setLowStockProducts(lowStock || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportDailyReport = async () => {
    if (!shop) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const doc = generateDailyReportPDF({
      shopName: shop.name,
      reportDate: format(new Date(), "MMMM dd, yyyy"),
      generatedAt: format(new Date(), "PPpp"),
      currency: shop.currency || "Le",
      summary: {
        totalSales: stats.todaySales,
        cashSales: stats.cashSales,
        creditSales: stats.creditSales,
        transactionCount: stats.todayTransactions,
        averageTransaction: stats.todayTransactions > 0 ? stats.todaySales / stats.todayTransactions : 0,
        totalProfit: 0,
      },
      salesByHour: [],
      topProducts: [],
      topCustomers: [],
      staffPerformance: [],
      outstandingLoans: [],
    });

    downloadPDF(doc, `daily-report-${today}.pdf`);
  };

  if (shopLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-foreground">No Shop Found</h2>
        <p className="text-muted-foreground mt-2">Please contact support if you believe this is an error.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back to {shop.name}</p>
        </div>
        {isOwner && (
          <Button onClick={handleExportDailyReport}>
            <Download className="mr-2 h-4 w-4" />
            Export Daily Report
          </Button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {shop.currency} {stats.todaySales.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Cash: {shop.currency} {stats.cashSales.toLocaleString()} | Credit: {shop.currency} {stats.creditSales.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayTransactions}</div>
            <p className="text-xs text-muted-foreground">Sales today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Total registered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.lowStockCount}</div>
            <p className="text-xs text-muted-foreground">Items need restocking</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Alerts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common tasks at your fingertips</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button className="w-full justify-start" variant="outline" asChild>
              <a href="/dashboard/pos">
                <ShoppingCart className="mr-2 h-4 w-4" />
                New Sale
              </a>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <a href="/dashboard/products">
                <FileText className="mr-2 h-4 w-4" />
                Add Product
              </a>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <a href="/dashboard/customers">
                <Users className="mr-2 h-4 w-4" />
                Add Customer
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>Products that need restocking</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">All products are well stocked!</p>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.slice(0, 5).map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-2 bg-destructive/10 rounded-lg">
                    <span className="text-sm font-medium">{product.name}</span>
                    <span className="text-sm text-destructive font-bold">
                      {product.quantity_on_hand} left
                    </span>
                  </div>
                ))}
                {lowStockProducts.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{lowStockProducts.length - 5} more items
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

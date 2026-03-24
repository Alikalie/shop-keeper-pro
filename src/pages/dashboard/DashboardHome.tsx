import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Clock,
  ArrowDownUp,
} from "lucide-react";
import { generateDailyReportPDF, downloadPDF } from "@/lib/pdf";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  totalCustomers: number;
  lowStockCount: number;
  cashSales: number;
  creditSales: number;
  transferSales: number;
  pendingOverpaymentsCount: number;
  pendingOverpaymentsAmount: number;
  pendingLoansCount: number;
  pendingLoansTotal: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  quantity_on_hand: number;
  low_stock_level: number;
}

interface RecentSale {
  id: string;
  receipt_id: string | null;
  total_amount: number;
  payment_type: string;
  created_at: string | null;
  staff_id: string;
  staff_name: string;
}

interface StaffDailySummary {
  staff_id: string;
  staff_name: string;
  transaction_count: number;
  total_sales: number;
  cash_sales: number;
  credit_sales: number;
  transfer_sales: number;
  last_sale_at: string | null;
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
    transferSales: 0,
    pendingOverpaymentsCount: 0,
    pendingOverpaymentsAmount: 0,
    pendingLoansCount: 0,
    pendingLoansTotal: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffDailySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shop) {
      fetchDashboardData();
    }
  }, [shop, isOwner]);

  const fetchDashboardData = async () => {
    if (!shop) return;

    try {
      setLoading(true);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const staffCredentialsPromise = isOwner
        ? supabase.from("staff_credentials").select("user_id, username").eq("shop_id", shop.id)
        : Promise.resolve({ data: [], error: null });

      const [
        todaySalesResult,
        recentSalesResult,
        customersResult,
        productsResult,
        overpaymentsResult,
        staffCredentialsResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("id, receipt_id, total_amount, payment_type, created_at, staff_id")
          .eq("shop_id", shop.id)
          .gte("created_at", startOfDay.toISOString())
          .lte("created_at", endOfDay.toISOString()),
        isOwner
          ? supabase
              .from("sales")
              .select("id, receipt_id, total_amount, payment_type, created_at, staff_id")
              .eq("shop_id", shop.id)
              .order("created_at", { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
        supabase.from("products").select("id, name, quantity_on_hand, low_stock_level").eq("shop_id", shop.id),
        supabase.from("overpayments").select("amount").eq("shop_id", shop.id).eq("status", "pending"),
        staffCredentialsPromise,
        supabase.from("loans").select("total_amount, amount_paid, status, customer_id, customers:customer_id(name)")
          .eq("shop_id", shop.id).neq("status", "paid"),
      ]);

      if (todaySalesResult.error) throw todaySalesResult.error;
      if (recentSalesResult.error) throw recentSalesResult.error;
      if (customersResult.error) throw customersResult.error;
      if (productsResult.error) throw productsResult.error;
      if (overpaymentsResult.error) throw overpaymentsResult.error;
      if (staffCredentialsResult.error) throw staffCredentialsResult.error;

      const salesData = todaySalesResult.data || [];
      const recentData = recentSalesResult.data || [];
      const productsData = productsResult.data || [];
      const pendingOverpayments = overpaymentsResult.data || [];
      const staffCredentials = staffCredentialsResult.data || [];

      const staffNameMap = Object.fromEntries(
        staffCredentials.map((credential) => [credential.user_id, credential.username])
      ) as Record<string, string>;

      const todaySales = salesData.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
      const cashSales = salesData
        .filter((sale) => sale.payment_type === "cash")
        .reduce((sum, sale) => sum + Number(sale.total_amount), 0);
      const creditSales = salesData
        .filter((sale) => sale.payment_type === "credit")
        .reduce((sum, sale) => sum + Number(sale.total_amount), 0);
      const transferSales = salesData
        .filter((sale) => sale.payment_type.startsWith("transfer"))
        .reduce((sum, sale) => sum + Number(sale.total_amount), 0);

      const filteredLowStock = productsData.filter(
        (product) => Number(product.quantity_on_hand || 0) <= Number(product.low_stock_level || 0)
      );

      setStats({
        todaySales,
        todayTransactions: salesData.length,
        totalCustomers: customersResult.count || 0,
        lowStockCount: filteredLowStock.length,
        cashSales,
        creditSales,
        transferSales,
        pendingOverpaymentsCount: pendingOverpayments.length,
        pendingOverpaymentsAmount: pendingOverpayments.reduce((sum, item) => sum + Number(item.amount), 0),
      });

      setLowStockProducts(filteredLowStock);

      if (isOwner) {
        const getStaffName = (staffId: string) => {
          if (staffId === shop.owner_id) return "Owner";
          return staffNameMap[staffId] || "Staff";
        };

        setRecentSales(
          recentData.map((sale) => ({
            ...sale,
            total_amount: Number(sale.total_amount),
            staff_name: getStaffName(sale.staff_id),
          }))
        );

        const staffSummaryMap = new Map<string, StaffDailySummary>();

        salesData.forEach((sale) => {
          const existing = staffSummaryMap.get(sale.staff_id) || {
            staff_id: sale.staff_id,
            staff_name: getStaffName(sale.staff_id),
            transaction_count: 0,
            total_sales: 0,
            cash_sales: 0,
            credit_sales: 0,
            transfer_sales: 0,
            last_sale_at: null,
          };

          const saleAmount = Number(sale.total_amount);
          existing.transaction_count += 1;
          existing.total_sales += saleAmount;
          if (sale.payment_type === "cash") existing.cash_sales += saleAmount;
          if (sale.payment_type === "credit") existing.credit_sales += saleAmount;
          if (sale.payment_type.startsWith("transfer")) existing.transfer_sales += saleAmount;
          if (!existing.last_sale_at || (sale.created_at && sale.created_at > existing.last_sale_at)) {
            existing.last_sale_at = sale.created_at;
          }

          staffSummaryMap.set(sale.staff_id, existing);
        });

        setStaffPerformance(
          Array.from(staffSummaryMap.values()).sort((a, b) => b.total_sales - a.total_sales)
        );
      } else {
        setRecentSales([]);
        setStaffPerformance([]);
      }
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {shop.currency} {stats.todaySales.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Cash {shop.currency} {stats.cashSales.toLocaleString()} • Loan {shop.currency} {stats.creditSales.toLocaleString()} • Transfer {shop.currency} {stats.transferSales.toLocaleString()}
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
            <p className="text-xs text-muted-foreground">Completed sales today</p>
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
            <CardTitle className="text-sm font-medium">Change Owed</CardTitle>
            <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingOverpaymentsCount}</div>
            <p className="text-xs text-muted-foreground">
              Pending {shop.currency} {stats.pendingOverpaymentsAmount.toLocaleString()}
            </p>
            <Link to="/dashboard/overpayments" className="mt-2 inline-block text-xs font-medium text-primary">
              Open Change Owed
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.lowStockCount}</div>
            <p className="text-xs text-muted-foreground">Items need restocking</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
              <Link to="/dashboard/pos">
                <ShoppingCart className="mr-2 h-4 w-4" />
                New Sale
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link to="/dashboard/products">
                <FileText className="mr-2 h-4 w-4" />
                Add Product
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link to="/dashboard/customers">
                <Users className="mr-2 h-4 w-4" />
                Add Customer
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
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
                  <div key={product.id} className="flex items-center justify-between rounded-lg border bg-muted/40 p-2">
                    <span className="text-sm font-medium">{product.name}</span>
                    <span className="text-sm font-bold text-foreground">
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

      {isOwner && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Daily Staff Sales Summary
              </CardTitle>
              <CardDescription>Combined shop sales for today by owner and staff</CardDescription>
            </CardHeader>
            <CardContent>
              {staffPerformance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sales recorded yet today.</p>
              ) : (
                <div className="space-y-3">
                  {staffPerformance.map((staff) => (
                    <div key={staff.staff_id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{staff.staff_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {staff.transaction_count} sale{staff.transaction_count === 1 ? "" : "s"}
                            {staff.last_sale_at ? ` • Last sale ${format(new Date(staff.last_sale_at), "HH:mm")}` : ""}
                          </p>
                        </div>
                        <p className="text-sm font-bold">
                          {shop.currency} {staff.total_sales.toLocaleString()}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline">Cash {shop.currency} {staff.cash_sales.toLocaleString()}</Badge>
                        <Badge variant="outline">Loan {shop.currency} {staff.credit_sales.toLocaleString()}</Badge>
                        <Badge variant="outline">Transfer {shop.currency} {staff.transfer_sales.toLocaleString()}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Staff Activity
              </CardTitle>
              <CardDescription>Latest sales across the shop</CardDescription>
            </CardHeader>
            <CardContent>
              {recentSales.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sales activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <ShoppingCart className="h-4 w-4 text-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{sale.staff_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {sale.created_at ? format(new Date(sale.created_at), "MMM dd, HH:mm") : "N/A"}
                            {" • "}
                            <span className="font-mono">{sale.receipt_id || sale.id.slice(0, 8)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          {shop.currency} {sale.total_amount.toLocaleString()}
                        </p>
                        <Badge variant={sale.payment_type === "cash" ? "default" : "secondary"} className="text-xs">
                          {sale.payment_type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
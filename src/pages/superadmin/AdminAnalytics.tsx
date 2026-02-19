import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Download } from "lucide-react";
import { generateDailyReportPDF, downloadPDF } from "@/lib/pdf";
import { format, startOfDay, endOfDay } from "date-fns";

interface AnalyticsData {
  totalRevenue: number;
  totalProfit: number;
  cashSales: number;
  creditSales: number;
  transactionCount: number;
  topProducts: { name: string; quantity: number; revenue: number; profit: number; shopName: string }[];
  topCustomers: { name: string; totalSpent: number; transactions: number; shopName: string }[];
  topShops: { shopName: string; revenue: number; transactions: number }[];
  outstandingLoans: { customerName: string; amount: number; shopName: string }[];
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");

  useEffect(() => { fetchAnalytics(); }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let salesQuery = supabase.from("sales").select(`
        id, total_amount, payment_type, shop_id, customer_id,
        shops:shop_id (name, currency, buying_price:products(buying_price)),
        sale_items (quantity, total, unit_price, products:product_id (name, buying_price))
      `);

      if (period !== "all") {
        const days = parseInt(period);
        const from = new Date();
        from.setDate(from.getDate() - days);
        salesQuery = salesQuery.gte("created_at", from.toISOString());
      }

      const { data: salesData } = await salesQuery;
      const { data: shopsData } = await supabase.from("shops").select("id, name, currency");
      const { data: loansData } = await supabase.from("loans").select(`
        total_amount, amount_paid, status, shop_id,
        customers:customer_id (name)
      `).neq("status", "paid");

      const { data: customersData } = await supabase.from("customers").select("id, name, outstanding_balance, shop_id");

      const shopMap = new Map((shopsData || []).map((s) => [s.id, s.name]));

      const totalRevenue = (salesData || []).reduce((s, r) => s + Number(r.total_amount), 0);
      const cashSales = (salesData || []).filter((s) => s.payment_type === "cash").reduce((s, r) => s + Number(r.total_amount), 0);
      const creditSales = (salesData || []).filter((s) => s.payment_type === "credit").reduce((s, r) => s + Number(r.total_amount), 0);

      // Calculate profit (selling - buying price)
      let totalProfit = 0;
      const productMap = new Map<string, { quantity: number; revenue: number; profit: number; shopName: string }>();
      const shopSalesMap = new Map<string, { revenue: number; transactions: number }>();

      (salesData || []).forEach((sale) => {
        const shopName = shopMap.get(sale.shop_id) || "Unknown";
        const shopCur = shopSalesMap.get(sale.shop_id) || { revenue: 0, transactions: 0 };
        shopSalesMap.set(sale.shop_id, {
          revenue: shopCur.revenue + Number(sale.total_amount),
          transactions: shopCur.transactions + 1,
        });

        (sale.sale_items || []).forEach((item: { quantity: number; total: number; unit_price: number; products: { name: string; buying_price: number } | null }) => {
          const pName = item.products?.name || "Unknown";
          const buyingPrice = item.products?.buying_price || 0;
          const itemProfit = (Number(item.unit_price) - Number(buyingPrice)) * item.quantity;
          totalProfit += itemProfit;

          const cur = productMap.get(pName) || { quantity: 0, revenue: 0, profit: 0, shopName };
          productMap.set(pName, {
            quantity: cur.quantity + item.quantity,
            revenue: cur.revenue + Number(item.total),
            profit: cur.profit + itemProfit,
            shopName,
          });
        });
      });

      const topProducts = Array.from(productMap.entries())
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const topShops = Array.from(shopSalesMap.entries())
        .map(([shopId, d]) => ({ shopName: shopMap.get(shopId) || "Unknown", ...d }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Top customers by outstanding balance
      const topCustomers = (customersData || [])
        .filter((c) => (c.outstanding_balance || 0) > 0)
        .sort((a, b) => (b.outstanding_balance || 0) - (a.outstanding_balance || 0))
        .slice(0, 10)
        .map((c) => ({
          name: c.name,
          totalSpent: c.outstanding_balance || 0,
          transactions: 0,
          shopName: shopMap.get(c.shop_id) || "Unknown",
        }));

      const outstandingLoans = (loansData || [])
        .map((l) => ({
          customerName: (l.customers as unknown as { name: string })?.name || "Unknown",
          amount: Number(l.total_amount) - Number(l.amount_paid || 0),
          shopName: shopMap.get(l.shop_id) || "Unknown",
        }))
        .filter((l) => l.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      setData({
        totalRevenue,
        totalProfit,
        cashSales,
        creditSales,
        transactionCount: salesData?.length || 0,
        topProducts,
        topCustomers,
        topShops,
        outstandingLoans,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!data) return;
    const doc = generateDailyReportPDF({
      shopName: "ABAF-SHOP Platform",
      reportDate: format(new Date(), "MMMM dd, yyyy"),
      generatedAt: format(new Date(), "PPpp"),
      currency: "Le",
      summary: {
        totalSales: data.totalRevenue,
        cashSales: data.cashSales,
        creditSales: data.creditSales,
        transactionCount: data.transactionCount,
        averageTransaction: data.transactionCount > 0 ? data.totalRevenue / data.transactionCount : 0,
        totalProfit: data.totalProfit,
      },
      salesByHour: [],
      topProducts: data.topProducts,
      topCustomers: data.topCustomers,
      staffPerformance: data.topShops.map((s) => ({ name: s.shopName, sales: s.revenue, transactions: s.transactions })),
      outstandingLoans: data.outstandingLoans,
    });
    downloadPDF(doc, `platform-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Platform Analytics</h1>
          <p className="text-muted-foreground">System-wide sales, profit, and performance data</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport} disabled={loading || !data}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Revenue", value: `Le ${data.totalRevenue.toLocaleString()}`, sub: `${data.transactionCount} transactions` },
              { label: "Total Profit", value: `Le ${data.totalProfit.toLocaleString()}`, sub: "After buying costs", highlight: true },
              { label: "Cash Sales", value: `Le ${data.cashSales.toLocaleString()}`, sub: "Direct payments" },
              { label: "Credit Sales", value: `Le ${data.creditSales.toLocaleString()}`, sub: "Loaned amounts", warn: true },
            ].map((s) => (
              <Card key={s.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${s.highlight ? "text-primary" : s.warn ? "text-destructive" : ""}`}>{s.value}</div>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle>🏆 Top Selling Products</CardTitle>
                <CardDescription>Highest revenue products across all shops</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.topProducts.slice(0, 8).map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.shopName} · {p.quantity} units</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">Le {p.revenue.toLocaleString()}</p>
                        <p className="text-xs text-primary">+Le {p.profit.toLocaleString()} profit</p>
                      </div>
                    </div>
                  ))}
                  {data.topProducts.length === 0 && <p className="text-muted-foreground text-center py-4">No sales data</p>}
                </div>
              </CardContent>
            </Card>

            {/* Top Shops */}
            <Card>
              <CardHeader>
                <CardTitle>🏪 Top Performing Shops</CardTitle>
                <CardDescription>Highest revenue shops on the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.topShops.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                      <div>
                        <p className="font-medium text-sm">{s.shopName}</p>
                        <p className="text-xs text-muted-foreground">{s.transactions} transactions</p>
                      </div>
                      <p className="font-bold text-sm">Le {s.revenue.toLocaleString()}</p>
                    </div>
                  ))}
                  {data.topShops.length === 0 && <p className="text-muted-foreground text-center py-4">No data</p>}
                </div>
              </CardContent>
            </Card>

            {/* Highest Buying Customers */}
            <Card>
              <CardHeader>
                <CardTitle>👥 Highest Balance Customers</CardTitle>
                <CardDescription>Customers with highest outstanding balances</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.topCustomers.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.shopName}</p>
                      </div>
                      <p className="font-bold text-sm text-destructive">Le {c.totalSpent.toLocaleString()}</p>
                    </div>
                  ))}
                  {data.topCustomers.length === 0 && <p className="text-muted-foreground text-center py-4">No outstanding balances</p>}
                </div>
              </CardContent>
            </Card>

            {/* Outstanding Loans */}
            <Card>
              <CardHeader>
                <CardTitle>💳 Outstanding Loans</CardTitle>
                <CardDescription>Largest unpaid debts across all shops</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.outstandingLoans.map((l, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                      <div>
                        <p className="font-medium text-sm">{l.customerName}</p>
                        <p className="text-xs text-muted-foreground">{l.shopName}</p>
                      </div>
                      <p className="font-bold text-sm text-destructive">Le {l.amount.toLocaleString()}</p>
                    </div>
                  ))}
                  {data.outstandingLoans.length === 0 && <p className="text-muted-foreground text-center py-4">No outstanding loans</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

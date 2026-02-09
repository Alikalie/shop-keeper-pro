import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useShop } from "@/hooks/useShop";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, Download, TrendingUp, DollarSign, Users, ShoppingCart } from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { generateDailyReportPDF, downloadPDF } from "@/lib/pdf";
import { cn } from "@/lib/utils";

interface ReportData {
  totalSales: number;
  cashSales: number;
  creditSales: number;
  transactionCount: number;
  averageTransaction: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  staffPerformance: { name: string; sales: number; transactions: number }[];
  outstandingLoans: { customerName: string; amount: number }[];
}

export default function Reports() {
  const { shop, isOwner } = useShop();
  const [date, setDate] = useState<Date>(new Date());
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shop && isOwner) {
      fetchReportData();
    }
  }, [shop, isOwner, date]);

  const fetchReportData = async () => {
    if (!shop) return;

    setLoading(true);

    try {
      const dayStart = startOfDay(date).toISOString();
      const dayEnd = endOfDay(date).toISOString();

      // Fetch sales for the day
      const { data: salesData } = await supabase
        .from("sales")
        .select(`
          id, total_amount, payment_type, staff_id,
          sale_items (
            quantity, total,
            products:product_id (name)
          )
        `)
        .eq("shop_id", shop.id)
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);

      const totalSales = salesData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;
      const cashSales = salesData?.filter(s => s.payment_type === "cash").reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;
      const creditSales = salesData?.filter(s => s.payment_type === "credit").reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;
      const transactionCount = salesData?.length || 0;

      // Calculate top products
      const productMap = new Map<string, { quantity: number; revenue: number }>();
      salesData?.forEach(sale => {
        (sale.sale_items || []).forEach((item: { quantity: number; total: number; products: { name: string } | null }) => {
          const productName = item.products?.name || "Unknown";
          const existing = productMap.get(productName) || { quantity: 0, revenue: 0 };
          productMap.set(productName, {
            quantity: existing.quantity + item.quantity,
            revenue: existing.revenue + Number(item.total),
          });
        });
      });

      const topProducts = Array.from(productMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Calculate staff performance
      const staffMap = new Map<string, { sales: number; transactions: number }>();
      salesData?.forEach(sale => {
        const staffId = sale.staff_id;
        const existing = staffMap.get(staffId) || { sales: 0, transactions: 0 };
        staffMap.set(staffId, {
          sales: existing.sales + Number(sale.total_amount),
          transactions: existing.transactions + 1,
        });
      });

      const staffPerformance = Array.from(staffMap.entries())
        .map(([staffId, data]) => ({ name: staffId.slice(0, 8), ...data }))
        .sort((a, b) => b.sales - a.sales);

      // Fetch outstanding loans
      const { data: loansData } = await supabase
        .from("loans")
        .select(`
          total_amount, amount_paid,
          customers:customer_id (name)
        `)
        .eq("shop_id", shop.id)
        .neq("status", "paid");

      const outstandingLoans = (loansData || [])
        .map((loan) => ({
          customerName: (loan.customers as unknown as { name: string })?.name || "Unknown",
          amount: Number(loan.total_amount) - Number(loan.amount_paid || 0),
        }))
        .filter(l => l.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      setReportData({
        totalSales,
        cashSales,
        creditSales,
        transactionCount,
        averageTransaction: transactionCount > 0 ? totalSales / transactionCount : 0,
        topProducts,
        staffPerformance,
        outstandingLoans,
      });
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!shop || !reportData) return;

    const doc = generateDailyReportPDF({
      shopName: shop.name,
      reportDate: format(date, "MMMM dd, yyyy"),
      generatedAt: format(new Date(), "PPpp"),
      currency: shop.currency || "Le",
      summary: {
        totalSales: reportData.totalSales,
        cashSales: reportData.cashSales,
        creditSales: reportData.creditSales,
        transactionCount: reportData.transactionCount,
        averageTransaction: reportData.averageTransaction,
      },
      salesByHour: [],
      topProducts: reportData.topProducts,
      staffPerformance: reportData.staffPerformance,
      outstandingLoans: reportData.outstandingLoans,
    });

    downloadPDF(doc, `daily-report-${format(date, "yyyy-MM-dd")}.pdf`);
  };

  if (!isOwner) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground mt-2">Only shop owners can view reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">Daily sales and performance reports</p>
        </div>
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button onClick={handleExportPDF} disabled={loading || !reportData}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : reportData ? (
        <>
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {shop?.currency} {reportData.totalSales.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cash Sales</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {shop?.currency} {reportData.cashSales.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Credit Sales</CardTitle>
                <Users className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {shop?.currency} {reportData.creditSales.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.transactionCount}</div>
                <p className="text-xs text-muted-foreground">
                  Avg: {shop?.currency} {Math.round(reportData.averageTransaction).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Details */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Products</CardTitle>
                <CardDescription>Best selling items today</CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales data for this date</p>
                ) : (
                  <div className="space-y-3">
                    {reportData.topProducts.map((product, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.quantity} units</p>
                        </div>
                        <span className="font-bold">
                          {shop?.currency} {product.revenue.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outstanding Loans</CardTitle>
                <CardDescription>Customers with unpaid balances</CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.outstandingLoans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No outstanding loans</p>
                ) : (
                  <div className="space-y-3">
                    {reportData.outstandingLoans.map((loan, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <p className="font-medium">{loan.customerName}</p>
                        <span className="font-bold text-destructive">
                          {shop?.currency} {loan.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

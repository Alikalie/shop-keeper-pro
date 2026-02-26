import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, Search, Eye, Download, User } from "lucide-react";
import { format } from "date-fns";
import { generateReceiptPDF, downloadPDF } from "@/lib/pdf";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface SaleRow {
  id: string;
  receipt_id: string | null;
  total_amount: number;
  amount_paid: number | null;
  payment_type: string;
  status: string | null;
  created_at: string | null;
  shopName: string;
  currency: string;
  staffId: string;
  staffName: string;
  customerName?: string;
  saleItems?: { name: string; quantity: number; unitPrice: number; total: number }[];
}

interface StaffSummary {
  staffId: string;
  staffName: string;
  shopName: string;
  totalSales: number;
  totalRevenue: number;
  cashSales: number;
  creditSales: number;
}

export default function AdminSales() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [shopFilter, setShopFilter] = useState("all");
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [viewSale, setViewSale] = useState<SaleRow | null>(null);
  const [activeTab, setActiveTab] = useState("sales");

  useEffect(() => { fetchSales(); }, []);

  const fetchSales = async () => {
    setLoading(true);
    const [shopsRes, profilesRes] = await Promise.all([
      supabase.from("shops").select("id, name, currency"),
      supabase.from("profiles").select("user_id, display_name"),
    ]);

    const shopMap = new Map((shopsRes.data || []).map((s) => [s.id, { name: s.name, currency: s.currency || "Le" }]));
    const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p.display_name || "Unknown"]));
    setShops((shopsRes.data || []).map((s) => ({ id: s.id, name: s.name })));

    const { data: salesData } = await supabase
      .from("sales")
      .select(`
        id, receipt_id, total_amount, amount_paid, payment_type, status, created_at, shop_id, customer_id, staff_id,
        customers:customer_id (name),
        sale_items (quantity, total, unit_price, products:product_id (name))
      `)
      .order("created_at", { ascending: false })
      .limit(500);

    // Also get staff credentials for username fallback
    const { data: creds } = await supabase.from("staff_credentials").select("user_id, username");
    const credMap = new Map((creds || []).map((c) => [c.user_id, c.username]));

    setSales((salesData || []).map((s: any) => ({
      id: s.id,
      receipt_id: s.receipt_id,
      total_amount: Number(s.total_amount),
      amount_paid: s.amount_paid ? Number(s.amount_paid) : null,
      payment_type: s.payment_type,
      status: s.status,
      created_at: s.created_at,
      shopName: shopMap.get(s.shop_id)?.name || "Unknown",
      currency: shopMap.get(s.shop_id)?.currency || "Le",
      staffId: s.staff_id,
      staffName: profileMap.get(s.staff_id) || credMap.get(s.staff_id) || "Unknown Staff",
      customerName: (s.customers as any)?.name,
      saleItems: ((s.sale_items || []) as any[]).map((item) => ({
        name: item.products?.name || "Unknown",
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        total: Number(item.total),
      })),
    })));
    setLoading(false);
  };

  const handlePrintReceipt = (sale: SaleRow) => {
    if (!sale.saleItems) return;
    const doc = generateReceiptPDF({
      shopName: sale.shopName,
      receiptId: sale.receipt_id || sale.id.slice(0, 8),
      date: sale.created_at ? format(new Date(sale.created_at), "PPpp") : format(new Date(), "PPpp"),
      items: sale.saleItems,
      totalAmount: sale.total_amount,
      amountPaid: sale.amount_paid || 0,
      paymentType: sale.payment_type,
      customerName: sale.customerName,
      currency: sale.currency,
    });
    downloadPDF(doc, `receipt-${sale.receipt_id || sale.id}.pdf`);
  };

  const filtered = sales.filter((s) => {
    const matchSearch = (s.receipt_id || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.customerName || "").toLowerCase().includes(search.toLowerCase()) ||
      s.shopName.toLowerCase().includes(search.toLowerCase()) ||
      s.staffName.toLowerCase().includes(search.toLowerCase());
    const matchShop = shopFilter === "all" || s.shopName === shops.find((sh) => sh.id === shopFilter)?.name;
    return matchSearch && matchShop;
  });

  const totalRevenue = filtered.reduce((s, r) => s + r.total_amount, 0);

  // Staff summary
  const staffSummaries: StaffSummary[] = (() => {
    const map = new Map<string, StaffSummary>();
    filtered.forEach((sale) => {
      const key = sale.staffId;
      const cur = map.get(key) || {
        staffId: sale.staffId,
        staffName: sale.staffName,
        shopName: sale.shopName,
        totalSales: 0,
        totalRevenue: 0,
        cashSales: 0,
        creditSales: 0,
      };
      cur.totalSales++;
      cur.totalRevenue += sale.total_amount;
      if (sale.payment_type === "cash") cur.cashSales++;
      else cur.creditSales++;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Sales & Staff Tracking</h1>
        <p className="text-muted-foreground">System-wide sales records and staff performance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Transactions</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{filtered.length.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Revenue</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">Le {totalRevenue.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Credit Sales</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{filtered.filter((s) => s.payment_type === "credit").length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Staff</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{staffSummaries.length}</div></CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={shopFilter} onValueChange={setShopFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All shops" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shops</SelectItem>
            {shops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search sales or staff..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sales">All Sales</TabsTrigger>
          <TabsTrigger value="staff">Staff Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Sales Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Shop</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 200).map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-xs">{sale.receipt_id || sale.id.slice(0, 8)}</TableCell>
                        <TableCell className="text-sm">{sale.shopName}</TableCell>
                        <TableCell className="text-sm font-medium">{sale.staffName}</TableCell>
                        <TableCell className="text-sm">{sale.customerName || "Walk-in"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sale.created_at ? format(new Date(sale.created_at), "MMM dd, HH:mm") : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sale.payment_type === "cash" ? "default" : "destructive"} className="capitalize">
                            {sale.payment_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{sale.currency} {sale.total_amount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewSale(sale)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrintReceipt(sale)}>
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No sales found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Staff Sales Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Name</TableHead>
                      <TableHead>Shop</TableHead>
                      <TableHead className="text-right">Total Sales</TableHead>
                      <TableHead className="text-right">Cash</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffSummaries.map((staff) => (
                      <TableRow key={staff.staffId}>
                        <TableCell className="font-medium">{staff.staffName}</TableCell>
                        <TableCell className="text-muted-foreground">{staff.shopName}</TableCell>
                        <TableCell className="text-right">{staff.totalSales}</TableCell>
                        <TableCell className="text-right">{staff.cashSales}</TableCell>
                        <TableCell className="text-right text-destructive">{staff.creditSales}</TableCell>
                        <TableCell className="text-right font-bold text-primary">Le {staff.totalRevenue.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {staffSummaries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No staff sales data</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Sale Details */}
      <Dialog open={!!viewSale} onOpenChange={() => setViewSale(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sale Details — {viewSale?.receipt_id}</DialogTitle>
          </DialogHeader>
          {viewSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Shop:</span> <span className="font-medium">{viewSale.shopName}</span></div>
                <div><span className="text-muted-foreground">Staff:</span> <span className="font-medium">{viewSale.staffName}</span></div>
                <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{viewSale.customerName || "Walk-in"}</span></div>
                <div><span className="text-muted-foreground">Payment:</span> <span className="font-medium capitalize">{viewSale.payment_type}</span></div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted"><tr><th className="text-left p-2">Item</th><th className="text-center p-2">Qty</th><th className="text-right p-2">Total</th></tr></thead>
                  <tbody>
                    {(viewSale.saleItems || []).map((item, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{item.name}</td>
                        <td className="text-center p-2">{item.quantity}</td>
                        <td className="text-right p-2">{viewSale.currency} {item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/50">
                    <tr><td colSpan={2} className="p-2 font-bold">TOTAL</td><td className="text-right p-2 font-bold">{viewSale.currency} {viewSale.total_amount.toLocaleString()}</td></tr>
                    <tr><td colSpan={2} className="p-2 text-muted-foreground">Paid</td><td className="text-right p-2">{viewSale.currency} {(viewSale.amount_paid || 0).toLocaleString()}</td></tr>
                  </tfoot>
                </table>
              </div>
              <Button className="w-full" onClick={() => handlePrintReceipt(viewSale)}>
                <Download className="mr-2 h-4 w-4" />
                Download Receipt PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

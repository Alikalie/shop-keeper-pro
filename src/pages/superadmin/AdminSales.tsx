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
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, Search, Eye, Download } from "lucide-react";
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
  customerName?: string;
  saleItems?: { name: string; quantity: number; unitPrice: number; total: number }[];
}

export default function AdminSales() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [shopFilter, setShopFilter] = useState("all");
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [viewSale, setViewSale] = useState<SaleRow | null>(null);

  useEffect(() => { fetchSales(); }, []);

  const fetchSales = async () => {
    setLoading(true);
    const { data: shopsData } = await supabase.from("shops").select("id, name, currency");
    const shopMap = new Map((shopsData || []).map((s) => [s.id, { name: s.name, currency: s.currency || "Le" }]));
    setShops((shopsData || []).map((s) => ({ id: s.id, name: s.name })));

    const { data: salesData } = await supabase
      .from("sales")
      .select(`
        id, receipt_id, total_amount, amount_paid, payment_type, status, created_at, shop_id, customer_id,
        customers:customer_id (name),
        sale_items (quantity, total, unit_price, products:product_id (name))
      `)
      .order("created_at", { ascending: false })
      .limit(500);

    setSales((salesData || []).map((s) => ({
      id: s.id,
      receipt_id: s.receipt_id,
      total_amount: Number(s.total_amount),
      amount_paid: s.amount_paid ? Number(s.amount_paid) : null,
      payment_type: s.payment_type,
      status: s.status,
      created_at: s.created_at,
      shopName: shopMap.get(s.shop_id)?.name || "Unknown",
      currency: shopMap.get(s.shop_id)?.currency || "Le",
      customerName: (s.customers as unknown as { name: string })?.name,
      saleItems: ((s.sale_items || []) as { quantity: number; total: number; unit_price: number; products: { name: string } | null }[]).map((item) => ({
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
      s.shopName.toLowerCase().includes(search.toLowerCase());
    const matchShop = shopFilter === "all" || s.shopName === shops.find((sh) => sh.id === shopFilter)?.name;
    return matchSearch && matchShop;
  });

  const totalRevenue = filtered.reduce((s, r) => s + r.total_amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">All Sales</h1>
        <p className="text-muted-foreground">System-wide sales records and receipts</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Sales Records
            </CardTitle>
            <div className="flex items-center gap-2">
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
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt ID</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono text-xs">{sale.receipt_id || sale.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{sale.shopName}</TableCell>
                    <TableCell className="text-sm">{sale.customerName || "Walk-in"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sale.created_at ? format(new Date(sale.created_at), "MMM dd, yyyy HH:mm") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sale.payment_type === "cash" ? "default" : "destructive"} className="capitalize">
                        {sale.payment_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{sale.currency} {sale.total_amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={sale.status === "completed" ? "default" : "secondary"} className="capitalize">
                        {sale.status || "completed"}
                      </Badge>
                    </TableCell>
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
                <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{viewSale.customerName || "Walk-in"}</span></div>
                <div><span className="text-muted-foreground">Payment:</span> <span className="font-medium capitalize">{viewSale.payment_type}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="font-medium capitalize">{viewSale.status}</span></div>
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

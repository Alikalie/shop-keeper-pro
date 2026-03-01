import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useShop } from "@/hooks/useShop";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Search, Calendar, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateReceiptPDF, downloadPDF } from "@/lib/pdf";
import { format } from "date-fns";

interface SaleWithItems {
  id: string;
  receipt_id: string | null;
  total_amount: number;
  amount_paid: number | null;
  payment_type: string;
  status: string | null;
  created_at: string | null;
  customer_id: string | null;
  staff_id: string;
  sale_items: {
    id: string;
    quantity: number;
    unit_price: number;
    total: number;
    product: { name: string };
  }[];
}

interface StaffInfo {
  user_id: string;
  display_name: string;
}

export default function SalesHistory() {
  const { shop, isOwner } = useShop();
  const { user } = useAuth();
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [staffList, setStaffList] = useState<StaffInfo[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (shop) {
      fetchSales();
      if (isOwner) fetchStaff();
    }
  }, [shop, isOwner]);

  const fetchStaff = async () => {
    if (!shop) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("shop_id", shop.id);

    const userIds = [...(roles || []).map(r => r.user_id), shop.owner_id];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

    const list: StaffInfo[] = (profiles || []).map(p => ({
      user_id: p.user_id,
      display_name: p.display_name || "Unknown",
    }));
    setStaffList(list);

    const names: Record<string, string> = {};
    list.forEach(s => { names[s.user_id] = s.display_name; });
    setStaffNames(names);
  };

  const fetchSales = async () => {
    if (!shop || !user) return;

    try {
      let query = supabase
        .from("sales")
        .select(`
          id, receipt_id, total_amount, amount_paid, payment_type, status, created_at, customer_id, staff_id,
          sale_items (
            id, quantity, unit_price, total,
            products:product_id (name)
          )
        `)
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false });

      if (!isOwner) {
        query = query.eq("staff_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const transformedSales: SaleWithItems[] = (data || []).map((sale) => ({
        ...sale,
        sale_items: (sale.sale_items || []).map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          product: { name: item.products?.name || "Unknown Product" },
        })),
      }));

      setSales(transformedSales);
    } catch (error) {
      console.error("Error fetching sales:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = (sale: SaleWithItems) => {
    if (!shop) return;
    const doc = generateReceiptPDF({
      shopName: shop.name,
      shopAddress: shop.address || undefined,
      shopPhone: shop.phone || undefined,
      receiptId: sale.receipt_id || sale.id.slice(0, 8),
      date: sale.created_at ? format(new Date(sale.created_at), "PPpp") : "N/A",
      items: sale.sale_items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        total: item.total,
      })),
      totalAmount: sale.total_amount,
      amountPaid: sale.amount_paid || 0,
      paymentType: sale.payment_type,
      currency: shop.currency || "Le",
      footer: shop.receipt_footer || undefined,
    });
    downloadPDF(doc, `receipt-${sale.receipt_id || sale.id.slice(0, 8)}.pdf`);
  };

  const filteredSales = sales.filter((s) => {
    const matchesSearch =
      s.receipt_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesDate = true;
    if (dateFrom && s.created_at) {
      matchesDate = new Date(s.created_at) >= new Date(dateFrom);
    }
    if (dateTo && s.created_at && matchesDate) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      matchesDate = new Date(s.created_at) <= to;
    }

    const matchesStaff = staffFilter === "all" || s.staff_id === staffFilter;

    return matchesSearch && matchesDate && matchesStaff;
  });

  const totalFiltered = filteredSales.reduce((sum, s) => sum + s.total_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales History</h1>
          <p className="text-muted-foreground">
            {isOwner ? "All shop sales" : "Your sales history"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-sm"><Search className="h-3 w-3" /> Search</Label>
              <Input
                placeholder="Search by receipt ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-sm"><Calendar className="h-3 w-3" /> From Date</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-sm"><Calendar className="h-3 w-3" /> To Date</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            {isOwner && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-sm"><User className="h-3 w-3" /> Staff</Label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger><SelectValue placeholder="All staff" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Staff</SelectItem>
                    {staffList.map(s => (
                      <SelectItem key={s.user_id} value={s.user_id}>{s.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {(dateFrom || dateTo || staffFilter !== "all" || searchQuery) && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {filteredSales.length} sales • Total: {shop?.currency} {totalFiltered.toLocaleString()}
              </p>
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setStaffFilter("all"); setSearchQuery(""); }}>
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transactions
          </CardTitle>
          <CardDescription>{filteredSales.length} sales found</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt ID</TableHead>
                <TableHead>Date</TableHead>
                {isOwner && <TableHead>Staff</TableHead>}
                <TableHead>Items</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono text-sm">
                    {sale.receipt_id || sale.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    {sale.created_at ? format(new Date(sale.created_at), "MMM dd, yyyy HH:mm") : "N/A"}
                  </TableCell>
                  {isOwner && (
                    <TableCell className="text-sm">
                      {staffNames[sale.staff_id] || sale.staff_id.slice(0, 8)}
                    </TableCell>
                  )}
                  <TableCell>
                    {sale.sale_items.length} item{sale.sale_items.length !== 1 ? "s" : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={sale.payment_type === "cash" ? "default" : "secondary"}>
                      {sale.payment_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {shop?.currency} {sale.total_amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDownloadReceipt(sale)} title="Download Receipt PDF">
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isOwner ? 7 : 6} className="text-center text-muted-foreground py-8">
                    {searchQuery || dateFrom || dateTo || staffFilter !== "all" ? "No sales match your filters" : "No sales recorded yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

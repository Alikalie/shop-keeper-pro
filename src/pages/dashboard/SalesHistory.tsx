import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useShop } from "@/hooks/useShop";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Eye, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
    product: {
      name: string;
    };
  }[];
}

export default function SalesHistory() {
  const { shop, isOwner } = useShop();
  const { user } = useAuth();
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (shop) {
      fetchSales();
    }
  }, [shop, isOwner]);

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

      // Staff can only see their own sales
      if (!isOwner) {
        query = query.eq("staff_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to expected format
      const transformedSales: SaleWithItems[] = (data || []).map((sale) => ({
        ...sale,
        sale_items: (sale.sale_items || []).map((item: { id: string; quantity: number; unit_price: number; total: number; products: { name: string } | null }) => ({
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

  const filteredSales = sales.filter(
    (s) =>
      s.receipt_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transactions
              </CardTitle>
              <CardDescription>{sales.length} sales recorded</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by receipt ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt ID</TableHead>
                <TableHead>Date</TableHead>
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
                    {sale.created_at
                      ? format(new Date(sale.created_at), "MMM dd, yyyy HH:mm")
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    {sale.sale_items.length} item{sale.sale_items.length !== 1 ? "s" : ""}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={sale.payment_type === "cash" ? "default" : "secondary"}
                    >
                      {sale.payment_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {shop?.currency} {sale.total_amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownloadReceipt(sale)}
                      title="Download Receipt PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {searchQuery ? "No sales match your search" : "No sales recorded yet"}
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

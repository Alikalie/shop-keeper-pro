import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useShop } from "@/hooks/useShop";
import { supabase } from "@/integrations/supabase/client";
import { Users, Calendar } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

type Period = "daily" | "weekly" | "monthly";

interface StaffRow {
  staff_id: string;
  staff_name: string;
  transaction_count: number;
  total_sales: number;
  cash_sales: number;
  credit_sales: number;
  transfer_sales: number;
}

export default function StaffPerformance() {
  const { shop } = useShop();
  const [period, setPeriod] = useState<Period>("daily");
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shop) fetchData();
  }, [shop, period]);

  const fetchData = async () => {
    if (!shop) return;
    setLoading(true);

    const now = new Date();
    let from: Date, to: Date;
    if (period === "daily") { from = startOfDay(now); to = endOfDay(now); }
    else if (period === "weekly") { from = startOfWeek(now, { weekStartsOn: 1 }); to = endOfWeek(now, { weekStartsOn: 1 }); }
    else { from = startOfMonth(now); to = endOfMonth(now); }

    const [salesRes, credsRes] = await Promise.all([
      supabase.from("sales")
        .select("staff_id, total_amount, payment_type")
        .eq("shop_id", shop.id)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString()),
      supabase.from("staff_credentials").select("user_id, username").eq("shop_id", shop.id),
    ]);

    const nameMap: Record<string, string> = {};
    (credsRes.data || []).forEach(c => { nameMap[c.user_id] = c.username; });

    const map = new Map<string, StaffRow>();
    (salesRes.data || []).forEach(s => {
      const existing = map.get(s.staff_id) || {
        staff_id: s.staff_id,
        staff_name: s.staff_id === shop.owner_id ? "Owner" : (nameMap[s.staff_id] || "Staff"),
        transaction_count: 0, total_sales: 0, cash_sales: 0, credit_sales: 0, transfer_sales: 0,
      };
      const amt = Number(s.total_amount);
      existing.transaction_count += 1;
      existing.total_sales += amt;
      if (s.payment_type === "cash") existing.cash_sales += amt;
      else if (s.payment_type === "credit") existing.credit_sales += amt;
      else if (s.payment_type?.startsWith("transfer")) existing.transfer_sales += amt;
      map.set(s.staff_id, existing);
    });

    setRows(Array.from(map.values()).sort((a, b) => b.total_sales - a.total_sales));
    setLoading(false);
  };

  const grandTotal = rows.reduce((s, r) => s + r.total_sales, 0);
  const currency = shop?.currency || "Le";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Staff Performance</h1>
          <p className="text-muted-foreground">Per-staff sales breakdown</p>
        </div>
        <div className="flex gap-2">
          {(["daily", "weekly", "monthly"] as Period[]).map(p => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)} className="capitalize">
              <Calendar className="mr-1 h-3 w-3" />{p}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Sales</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{currency} {grandTotal.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Transactions</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{rows.reduce((s, r) => s + r.transaction_count, 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Staff</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{rows.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Staff Breakdown — {period.charAt(0).toUpperCase() + period.slice(1)}</CardTitle>
          <CardDescription>Sales totals per staff member for the current {period === "daily" ? "day" : period === "weekly" ? "week" : "month"}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Cash</TableHead>
                  <TableHead className="text-right">Loan</TableHead>
                  <TableHead className="text-right">Transfer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.staff_id}>
                    <TableCell className="font-medium">{r.staff_name}</TableCell>
                    <TableCell className="text-right">{r.transaction_count}</TableCell>
                    <TableCell className="text-right">{currency} {r.cash_sales.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{currency} {r.credit_sales.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{currency} {r.transfer_sales.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold">{currency} {r.total_sales.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No sales for this period</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

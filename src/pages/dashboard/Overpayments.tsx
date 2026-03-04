import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ArrowDownUp, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface Overpayment {
  id: string;
  customer_name: string;
  customer_id: string | null;
  receipt_id: string | null;
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export default function Overpayments() {
  const { shop } = useShop();
  const { toast } = useToast();
  const [overpayments, setOverpayments] = useState<Overpayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shop) fetchOverpayments();
  }, [shop]);

  const fetchOverpayments = async () => {
    if (!shop) return;
    const { data, error } = await supabase
      .from("overpayments")
      .select("*")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching overpayments:", error);
    } else {
      setOverpayments(data || []);
    }
    setLoading(false);
  };

  const markResolved = async (id: string) => {
    const { error } = await supabase
      .from("overpayments")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Marked as resolved" });
      fetchOverpayments();
    }
  };

  const totalPending = overpayments
    .filter((o) => o.status === "pending")
    .reduce((sum, o) => sum + Number(o.amount), 0);

  const totalResolved = overpayments
    .filter((o) => o.status === "resolved")
    .reduce((sum, o) => sum + Number(o.amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Change / Overpayments</h1>
      <p className="text-muted-foreground">
        Track change owed to customers when they overpay. Mark as resolved once returned.
      </p>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{shop?.currency} {totalPending.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold">{shop?.currency} {totalResolved.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ArrowDownUp className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{overpayments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Overpayment Records</CardTitle>
        </CardHeader>
        <CardContent>
          {overpayments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No overpayment records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead className="text-right">Change Owed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resolved At</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overpayments.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(op.created_at), "PPp")}
                      </TableCell>
                      <TableCell className="font-medium">{op.customer_name}</TableCell>
                      <TableCell className="font-mono text-xs">{op.receipt_id || "—"}</TableCell>
                      <TableCell className="text-right font-bold">
                        {shop?.currency} {Number(op.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={op.status === "pending" ? "destructive" : "secondary"}>
                          {op.status === "pending" ? (
                            <><Clock className="mr-1 h-3 w-3" /> Pending</>
                          ) : (
                            <><CheckCircle className="mr-1 h-3 w-3" /> Resolved</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {op.resolved_at ? format(new Date(op.resolved_at), "PPp") : "—"}
                      </TableCell>
                      <TableCell>
                        {op.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => markResolved(op.id)}>
                            Mark Returned
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

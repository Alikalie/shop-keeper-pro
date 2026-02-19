import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Search, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface LoanRow {
  id: string;
  total_amount: number;
  amount_paid: number | null;
  status: string | null;
  created_at: string | null;
  shop_id: string;
  shopName: string;
  customerName: string;
  customerPhone: string | null;
}

export default function AdminLoans() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLoan, setSelectedLoan] = useState<LoanRow | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { fetchLoans(); }, []);

  const fetchLoans = async () => {
    setLoading(true);
    const { data: loansData } = await supabase
      .from("loans")
      .select(`id, total_amount, amount_paid, status, created_at, shop_id, customers:customer_id (name, phone)`)
      .order("created_at", { ascending: false });

    const { data: shopsData } = await supabase.from("shops").select("id, name");
    const shopMap = new Map((shopsData || []).map((s) => [s.id, s.name]));

    setLoans((loansData || []).map((l) => ({
      id: l.id,
      total_amount: Number(l.total_amount),
      amount_paid: l.amount_paid ? Number(l.amount_paid) : null,
      status: l.status,
      created_at: l.created_at,
      shop_id: l.shop_id,
      shopName: shopMap.get(l.shop_id) || "Unknown",
      customerName: (l.customers as unknown as { name: string })?.name || "Unknown",
      customerPhone: (l.customers as unknown as { phone: string | null })?.phone || null,
    })));
    setLoading(false);
  };

  const handlePayment = async () => {
    if (!selectedLoan || !user) return;
    const amount = parseFloat(paymentAmount);
    const remaining = selectedLoan.total_amount - (selectedLoan.amount_paid || 0);
    if (!amount || amount <= 0 || amount > remaining) {
      toast({ variant: "destructive", title: "Invalid Amount", description: `Must be between 1 and ${remaining}` });
      return;
    }
    setIsSubmitting(true);
    try {
      await supabase.from("loan_payments").insert({ loan_id: selectedLoan.id, amount, received_by: user.id });
      const newPaid = (selectedLoan.amount_paid || 0) + amount;
      const newStatus = newPaid >= selectedLoan.total_amount ? "paid" : "partial";
      await supabase.from("loans").update({ amount_paid: newPaid, status: newStatus }).eq("id", selectedLoan.id);
      toast({ title: "Payment recorded" });
      setSelectedLoan(null);
      setPaymentAmount("");
      fetchLoans();
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to record payment" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("loans").delete().eq("id", deleteId);
    toast({ title: "Loan deleted" });
    setDeleteId(null);
    fetchLoans();
  };

  const filtered = loans.filter((l) => {
    const matchSearch = l.customerName.toLowerCase().includes(search.toLowerCase()) ||
      l.shopName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalOutstanding = filtered.reduce((s, l) => s + (l.total_amount - (l.amount_paid || 0)), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Loans & Credits</h1>
        <p className="text-muted-foreground">Manage all loans and credit across all shops</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Loans</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{loans.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Unpaid</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{loans.filter((l) => l.status === "unpaid" || !l.status).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">Le {totalOutstanding.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              All Loans
            </CardTitle>
            <div className="flex items-center gap-2">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
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
                  <TableHead>Customer</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((loan) => {
                  const balance = loan.total_amount - (loan.amount_paid || 0);
                  return (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{loan.customerName}</p>
                          {loan.customerPhone && <p className="text-xs text-muted-foreground">{loan.customerPhone}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{loan.shopName}</TableCell>
                      <TableCell className="text-sm">{loan.created_at ? format(new Date(loan.created_at), "MMM dd, yyyy") : "—"}</TableCell>
                      <TableCell className="text-right">Le {loan.total_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">Le {(loan.amount_paid || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-destructive">Le {balance.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={loan.status === "paid" ? "default" : loan.status === "partial" ? "secondary" : "destructive"} className="capitalize">
                          {loan.status || "unpaid"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {balance > 0 && (
                            <Button variant="outline" size="sm" onClick={() => setSelectedLoan(loan)}>
                              <Plus className="mr-1 h-3 w-3" />
                              Pay
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(loan.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No loans found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={!!selectedLoan} onOpenChange={() => { setSelectedLoan(null); setPaymentAmount(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>For {selectedLoan?.customerName} @ {selectedLoan?.shopName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span className="font-medium">Le {selectedLoan?.total_amount.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid:</span><span className="font-medium">Le {(selectedLoan?.amount_paid || 0).toLocaleString()}</span></div>
              <div className="flex justify-between font-bold border-t pt-2"><span>Remaining:</span><span className="text-destructive">Le {((selectedLoan?.total_amount || 0) - (selectedLoan?.amount_paid || 0)).toLocaleString()}</span></div>
            </div>
            <div className="space-y-2">
              <Label>Payment Amount (Le)</Label>
              <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Enter amount" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLoan(null)}>Cancel</Button>
            <Button onClick={handlePayment} disabled={isSubmitting}>{isSubmitting ? "Recording..." : "Record Payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Loan</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">This will permanently delete this loan record and all payment history.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

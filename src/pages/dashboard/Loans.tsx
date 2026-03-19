import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useShop } from "@/hooks/useShop";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Plus, Search } from "lucide-react";
import { format } from "date-fns";

interface LoanWithCustomer {
  id: string;
  customer_id: string;
  total_amount: number;
  amount_paid: number | null;
  status: string | null;
  created_at: string | null;
  customer: {
    name: string;
    phone: string | null;
    outstanding_balance: number | null;
  };
}

export default function Loans() {
  const { shop } = useShop();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loans, setLoans] = useState<LoanWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<LoanWithCustomer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (shop) {
      fetchLoans();
    }
  }, [shop]);

  const fetchLoans = async () => {
    if (!shop) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("loans")
        .select(`
          id, customer_id, total_amount, amount_paid, status, created_at,
          customers:customer_id (name, phone, outstanding_balance)
        `)
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const transformedLoans: LoanWithCustomer[] = (data || []).map((loan) => ({
        id: loan.id,
        customer_id: loan.customer_id,
        total_amount: Number(loan.total_amount),
        amount_paid: loan.amount_paid ? Number(loan.amount_paid) : 0,
        status: loan.status,
        created_at: loan.created_at,
        customer: {
          name: (loan.customers as unknown as { name?: string })?.name || "Unknown",
          phone: (loan.customers as unknown as { phone?: string | null })?.phone || null,
          outstanding_balance:
            (loan.customers as unknown as { outstanding_balance?: number | null })?.outstanding_balance || 0,
        },
      }));

      setLoans(transformedLoans);
    } catch (error) {
      console.error("Error fetching loans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedLoan || !user) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a loan to repay.",
      });
      return;
    }

    const amount = Number.parseFloat(paymentAmount);
    const remaining = Math.max(selectedLoan.total_amount - (selectedLoan.amount_paid || 0), 0);

    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: `Payment must be between 1 and ${remaining.toLocaleString()}`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const newPaidAmount = (selectedLoan.amount_paid || 0) + amount;
      const newStatus = newPaidAmount >= selectedLoan.total_amount ? "paid" : "partial";
      const newOutstandingBalance = Math.max(Number(selectedLoan.customer.outstanding_balance || 0) - amount, 0);

      const [paymentResult, loanResult, customerResult] = await Promise.all([
        supabase.from("loan_payments").insert({
          loan_id: selectedLoan.id,
          amount,
          received_by: user.id,
        }),
        supabase
          .from("loans")
          .update({
            amount_paid: newPaidAmount,
            status: newStatus,
          })
          .eq("id", selectedLoan.id),
        supabase
          .from("customers")
          .update({ outstanding_balance: newOutstandingBalance })
          .eq("id", selectedLoan.customer_id),
      ]);

      if (paymentResult.error) throw paymentResult.error;
      if (loanResult.error) throw loanResult.error;
      if (customerResult.error) throw customerResult.error;

      toast({
        title: "Repayment Recorded",
        description: `${shop?.currency} ${amount.toLocaleString()} applied successfully.`,
      });

      setSelectedLoan(null);
      setPaymentAmount("");
      fetchLoans();
    } catch (error) {
      console.error("Error recording payment:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record loan repayment",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string | null, totalAmount: number, amountPaid: number | null) => {
    const paid = amountPaid || 0;
    if (paid >= totalAmount || status === "paid") {
      return <Badge variant="default">Paid</Badge>;
    }
    if (paid > 0 || status === "partial" || status === "part-paid") {
      return <Badge variant="secondary">Partial</Badge>;
    }
    return <Badge variant="destructive">Unpaid</Badge>;
  };

  const filteredLoans = loans.filter((loan) =>
    loan.customer.name.toLowerCase().includes(searchQuery.toLowerCase())
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
          <h1 className="text-3xl font-bold text-foreground">Loans</h1>
          <p className="text-muted-foreground">Track customer credit and repayments</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Outstanding Loans
              </CardTitle>
              <CardDescription>
                {loans.filter((loan) => (loan.amount_paid || 0) < loan.total_amount).length} active loans
              </CardDescription>
            </div>
            <div className="relative w-full max-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer..."
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
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Customer Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLoans.map((loan) => {
                const balance = loan.total_amount - (loan.amount_paid || 0);
                return (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{loan.customer.name}</p>
                        {loan.customer.phone && (
                          <p className="text-xs text-muted-foreground">{loan.customer.phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {loan.created_at
                        ? format(new Date(loan.created_at), "MMM dd, yyyy")
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      {shop?.currency} {loan.total_amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {shop?.currency} {(loan.amount_paid || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      {shop?.currency} {balance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {shop?.currency} {Number(loan.customer.outstanding_balance || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(loan.status, loan.total_amount, loan.amount_paid)}
                    </TableCell>
                    <TableCell className="text-right">
                      {balance > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLoan(loan);
                            setPaymentAmount("");
                          }}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Repay
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredLoans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {searchQuery ? "No loans match your search" : "No loans recorded"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLoan} onOpenChange={() => setSelectedLoan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Repayment</DialogTitle>
            <DialogDescription>
              Apply a partial or full repayment for {selectedLoan?.customer.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2 rounded-lg bg-muted/50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Loan:</span>
                <span className="font-medium">
                  {shop?.currency} {selectedLoan?.total_amount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-medium">
                  {shop?.currency} {(selectedLoan?.amount_paid || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer Balance:</span>
                <span className="font-medium">
                  {shop?.currency} {Number(selectedLoan?.customer.outstanding_balance || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-sm font-bold">
                <span>Remaining on This Loan:</span>
                <span className="text-destructive">
                  {shop?.currency}{" "}
                  {(
                    (selectedLoan?.total_amount || 0) - (selectedLoan?.amount_paid || 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="amount">Repayment Amount</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPaymentAmount(
                      String((selectedLoan?.total_amount || 0) - (selectedLoan?.amount_paid || 0))
                    )
                  }
                >
                  Use Full Remaining
                </Button>
              </div>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLoan(null)}>
              Cancel
            </Button>
            <Button onClick={handlePayment} disabled={isSubmitting}>
              {isSubmitting ? "Recording..." : "Record Repayment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
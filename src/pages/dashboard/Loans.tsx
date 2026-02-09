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
  total_amount: number;
  amount_paid: number | null;
  status: string | null;
  created_at: string | null;
  customer: {
    name: string;
    phone: string | null;
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
      const { data, error } = await supabase
        .from("loans")
        .select(`
          id, total_amount, amount_paid, status, created_at,
          customers:customer_id (name, phone)
        `)
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const transformedLoans: LoanWithCustomer[] = (data || []).map((loan) => ({
        ...loan,
        customer: {
          name: (loan.customers as unknown as { name: string })?.name || "Unknown",
          phone: (loan.customers as unknown as { phone: string | null })?.phone || null,
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
    if (!selectedLoan || !paymentAmount || !user) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please enter a payment amount.",
      });
      return;
    }

    const amount = parseFloat(paymentAmount);
    const remaining = selectedLoan.total_amount - (selectedLoan.amount_paid || 0);

    if (amount <= 0 || amount > remaining) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: `Payment must be between 1 and ${remaining.toLocaleString()}`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Record payment
      const { error: paymentError } = await supabase.from("loan_payments").insert({
        loan_id: selectedLoan.id,
        amount,
        received_by: user.id,
      });

      if (paymentError) throw paymentError;

      // Update loan
      const newPaidAmount = (selectedLoan.amount_paid || 0) + amount;
      const newStatus = newPaidAmount >= selectedLoan.total_amount ? "paid" : "partial";

      const { error: loanError } = await supabase
        .from("loans")
        .update({
          amount_paid: newPaidAmount,
          status: newStatus,
        })
        .eq("id", selectedLoan.id);

      if (loanError) throw loanError;

      toast({
        title: "Payment Recorded",
        description: `${shop?.currency} ${amount.toLocaleString()} payment recorded successfully.`,
      });

      setSelectedLoan(null);
      setPaymentAmount("");
      fetchLoans();
    } catch (error) {
      console.error("Error recording payment:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record payment",
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
    if (paid > 0 || status === "partial") {
      return <Badge variant="secondary">Partial</Badge>;
    }
    return <Badge variant="destructive">Unpaid</Badge>;
  };

  const filteredLoans = loans.filter((l) =>
    l.customer.name.toLowerCase().includes(searchQuery.toLowerCase())
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
          <p className="text-muted-foreground">Track customer credit and payments</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Outstanding Loans
              </CardTitle>
              <CardDescription>
                {loans.filter((l) => (l.amount_paid || 0) < l.total_amount).length} unpaid loans
              </CardDescription>
            </div>
            <div className="relative w-64">
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
                    <TableCell>
                      {getStatusBadge(loan.status, loan.total_amount, loan.amount_paid)}
                    </TableCell>
                    <TableCell className="text-right">
                      {balance > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLoan(loan)}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Payment
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredLoans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {searchQuery ? "No loans match your search" : "No loans recorded"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={!!selectedLoan} onOpenChange={() => setSelectedLoan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Recording payment for {selectedLoan?.customer.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Amount:</span>
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
              <div className="flex justify-between text-sm font-bold border-t pt-2">
                <span>Remaining:</span>
                <span className="text-destructive">
                  {shop?.currency}{" "}
                  {(
                    (selectedLoan?.total_amount || 0) - (selectedLoan?.amount_paid || 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount</Label>
              <Input
                id="amount"
                type="number"
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
              {isSubmitting ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

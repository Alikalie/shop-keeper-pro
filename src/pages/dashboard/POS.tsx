import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useShop } from "@/hooks/useShop";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Printer,
  CreditCard,
  Banknote,
  X,
  ArrowRightLeft,
  Download,
  AlertTriangle,
} from "lucide-react";
import { generateReceiptPDF, downloadPDF } from "@/lib/pdf";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;
type Customer = Pick<Tables<"customers">, "id" | "name" | "phone" | "address" | "outstanding_balance">;

interface CartItem {
  product: Product;
  quantity: number;
}

interface TransferDetails {
  transferType: string;
  providerName: string;
  accountNumber: string;
  transactionRef: string;
  senderName: string;
}

interface PendingCheckoutPayload {
  paid: number;
  changeAmount: number;
}

const emptyTransferDetails: TransferDetails = {
  transferType: "mobile",
  providerName: "",
  accountNumber: "",
  transactionRef: "",
  senderName: "",
};

export default function POS() {
  const { shop } = useShop();
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("walkin");
  const [paymentType, setPaymentType] = useState<string>("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transferDetails, setTransferDetails] = useState<TransferDetails>(emptyTransferDetails);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptDoc, setReceiptDoc] = useState<any>(null);
  const [receiptId, setReceiptIdState] = useState("");
  const [confirmOverpaymentOpen, setConfirmOverpaymentOpen] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckoutPayload | null>(null);

  useEffect(() => {
    if (shop) {
      fetchProducts();
      fetchCustomers();
    }
  }, [shop]);

  const fetchProducts = async () => {
    if (!shop) return;
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("shop_id", shop.id)
      .gt("quantity_on_hand", 0)
      .order("name");

    setProducts(data || []);
    setLoading(false);
  };

  const fetchCustomers = async () => {
    if (!shop) return;
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone, address, outstanding_balance")
      .eq("shop_id", shop.id)
      .order("name");

    setCustomers(data || []);
  };

  const filteredProducts = useMemo(
    () => products.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [products, searchQuery]
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0),
    [cart]
  );

  const paidAmount = useMemo(() => {
    const parsed = Number.parseFloat(amountPaid);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amountPaid]);

  const balanceDue = Math.max(cartTotal - paidAmount, 0);
  const changeAmount = Math.max(paidAmount - cartTotal, 0);
  const selectedCustomerRecord = customers.find((customer) => customer.id === selectedCustomer);
  const requiresRegisteredCustomer = paymentType === "credit";
  const canUseCredit = Boolean(selectedCustomer && selectedCustomer !== "walkin");

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);

    if (existing) {
      if (existing.quantity >= (product.quantity_on_hand || 0)) {
        toast({ variant: "destructive", title: "Insufficient Stock", description: `Only ${product.quantity_on_hand} available` });
        return;
      }

      setCart(cart.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      return;
    }

    if ((product.quantity_on_hand || 0) <= 0) {
      toast({ variant: "destructive", title: "Out of Stock", description: `${product.name} is out of stock` });
      return;
    }

    setCart([...cart, { product, quantity: 1 }]);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + delta;

          if (newQty > (item.product.quantity_on_hand || 0)) {
            toast({ variant: "destructive", title: "Insufficient Stock" });
            return item;
          }

          return { ...item, quantity: newQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const generateReceiptId = () => {
    const prefix = (shop?.name || "ABAF").substring(0, 4).toUpperCase();
    const date = format(new Date(), "yyyyMMdd");
    const random = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}-${date}-${random}`;
  };

  const resetSaleState = async () => {
    setCart([]);
    setAmountPaid("");
    setSelectedCustomer("walkin");
    setPaymentType("cash");
    setTransferDetails(emptyTransferDetails);
    setPendingCheckout(null);
    setConfirmOverpaymentOpen(false);
    await fetchProducts();
    await fetchCustomers();
  };

  const finalizeCheckout = async (paid: number) => {
    if (!shop || !user || cart.length === 0) return;

    setIsProcessing(true);

    try {
      const newReceiptId = generateReceiptId();
      const customerId = selectedCustomer && selectedCustomer !== "walkin" ? selectedCustomer : null;
      const paymentLabel = paymentType === "transfer"
        ? `transfer-${transferDetails.transferType}`
        : paymentType;
      const saleStatus = paymentType === "credit"
        ? (paid <= 0 ? "unpaid" : paid < cartTotal ? "partial" : "completed")
        : "completed";

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          shop_id: shop.id,
          staff_id: user.id,
          customer_id: customerId,
          total_amount: cartTotal,
          amount_paid: paid,
          payment_type: paymentLabel,
          receipt_id: newReceiptId,
          status: saleStatus,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.selling_price,
        total: item.product.selling_price * item.quantity,
      }));

      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
      if (itemsError) throw itemsError;

      const stockUpdates = await Promise.all(
        cart.map(async (item) => {
          const newQty = (item.product.quantity_on_hand || 0) - item.quantity;

          const [productRes, movementRes] = await Promise.all([
            supabase.from("products").update({ quantity_on_hand: newQty }).eq("id", item.product.id),
            supabase.from("stock_movements").insert({
              product_id: item.product.id,
              shop_id: shop.id,
              movement_type: "sale",
              quantity: -item.quantity,
              recorded_by: user.id,
              reference_id: sale.id,
              reference_type: "sale",
              notes: `Sale ${newReceiptId}`,
            }),
          ]);

          if (productRes.error) throw productRes.error;
          if (movementRes.error) throw movementRes.error;
        })
      );

      await Promise.all(stockUpdates);

      if (paymentType === "credit" && customerId) {
        const loanAmountPaid = Math.min(paid, cartTotal);
        const loanStatus = loanAmountPaid <= 0 ? "unpaid" : loanAmountPaid < cartTotal ? "part-paid" : "paid";

        const { error: loanError } = await supabase.from("loans").insert({
          shop_id: shop.id,
          customer_id: customerId,
          sale_id: sale.id,
          total_amount: cartTotal,
          amount_paid: loanAmountPaid,
          status: loanStatus,
        });

        if (loanError) throw loanError;

        const currentBalance = Number(selectedCustomerRecord?.outstanding_balance || 0);
        const { error: customerBalanceError } = await supabase
          .from("customers")
          .update({ outstanding_balance: currentBalance + Math.max(cartTotal - loanAmountPaid, 0) })
          .eq("id", customerId);

        if (customerBalanceError) throw customerBalanceError;
      }

      if (paid > cartTotal) {
        const { error: overpaymentError } = await supabase.from("overpayments").insert({
          shop_id: shop.id,
          customer_id: customerId,
          customer_name: selectedCustomerRecord?.name || "Walk-in Customer",
          sale_id: sale.id,
          receipt_id: newReceiptId,
          amount: paid - cartTotal,
          status: "pending",
          notes: `Change of ${shop.currency || "Le"} ${(paid - cartTotal).toLocaleString()} from ${paymentLabel} payment`,
        });

        if (overpaymentError) throw overpaymentError;
      }

      const doc = generateReceiptPDF({
        shopName: shop.name,
        shopAddress: shop.address || undefined,
        shopPhone: shop.phone || undefined,
        shopLogoUrl: shop.logo_url || undefined,
        receiptId: newReceiptId,
        date: format(new Date(), "PPpp"),
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.selling_price,
          total: item.product.selling_price * item.quantity,
        })),
        totalAmount: cartTotal,
        amountPaid: paid,
        paymentType: paymentLabel,
        customerName: selectedCustomerRecord?.name,
        customerPhone: selectedCustomerRecord?.phone || undefined,
        customerAddress: selectedCustomerRecord?.address || undefined,
        currency: shop.currency || "Le",
        footer: shop.receipt_footer || undefined,
        transferDetails: paymentType === "transfer" ? transferDetails : undefined,
      });

      setReceiptDoc(doc);
      setReceiptIdState(newReceiptId);
      setReceiptModalOpen(true);

      toast({ title: "Sale Completed!", description: `Receipt: ${newReceiptId}` });
      await resetSaleState();
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        variant: "destructive",
        title: "Checkout Failed",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = async () => {
    if (!shop || !user || cart.length === 0) return;

    if (paymentType === "cash") {
      if (paidAmount < cartTotal) {
        toast({ variant: "destructive", title: "Insufficient Payment", description: `Amount paid (${paidAmount}) is less than total (${cartTotal})` });
        return;
      }
    }

    if (requiresRegisteredCustomer && !canUseCredit) {
      toast({ variant: "destructive", title: "Customer Required", description: "Please select a registered customer for loan sales." });
      return;
    }

    if (paymentType === "credit" && paidAmount > cartTotal) {
      toast({ variant: "destructive", title: "Invalid Loan Payment", description: "Loan payment cannot be more than the sale total." });
      return;
    }

    if (paymentType === "transfer") {
      if (paidAmount < cartTotal) {
        toast({ variant: "destructive", title: "Insufficient Payment", description: "Transfer amount must cover the full total." });
        return;
      }

      if (!transferDetails.providerName || !transferDetails.transactionRef || !transferDetails.senderName) {
        toast({ variant: "destructive", title: "Transfer Details Required", description: "Fill bank/mobile provider, reference, and sender name." });
        return;
      }
    }

    if ((paymentType === "cash" || paymentType === "transfer") && paidAmount > cartTotal) {
      setPendingCheckout({ paid: paidAmount, changeAmount: paidAmount - cartTotal });
      setConfirmOverpaymentOpen(true);
      return;
    }

    await finalizeCheckout(paidAmount);
  };

  const handleConfirmOverpayment = async () => {
    if (!pendingCheckout) return;
    await finalizeCheckout(pendingCheckout.paid);
  };

  const handleCancelOverpayment = () => {
    setPendingCheckout(null);
    setConfirmOverpaymentOpen(false);
  };

  const handlePrintReceipt = () => {
    if (!receiptDoc) return;
    const blob = receiptDoc.output("blob");
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  };

  const handleDownloadReceipt = () => {
    if (!receiptDoc) return;
    downloadPDF(receiptDoc, `receipt-${receiptId}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Point of Sale</h1>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer transition-colors hover:border-primary"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-3">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    {product.sku && <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-primary">
                        {shop?.currency} {product.selling_price.toLocaleString()}
                      </span>
                      <Badge
                        variant={(product.quantity_on_hand || 0) <= (product.low_stock_level || 10) ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {product.quantity_on_hand}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredProducts.length === 0 && (
                <div className="col-span-full py-8 text-center text-muted-foreground">
                  {searchQuery ? "No products match your search" : "No products in stock"}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingCart className="h-5 w-5" />
                  Cart ({cart.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cart.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Cart is empty. Click products to add.</p>
                ) : (
                  <>
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {shop?.currency} {item.product.selling_price.toLocaleString()} × {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromCart(item.product.id)}>
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <span className="min-w-[60px] text-right text-sm font-bold">
                          {shop?.currency} {(item.product.selling_price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}

                    <div className="space-y-3 border-t pt-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>{shop?.currency} {cartTotal.toLocaleString()}</span>
                      </div>

                      <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                        <SelectTrigger>
                          <SelectValue placeholder="Walk-in Customer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="walkin">Walk-in Customer</SelectItem>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {selectedCustomerRecord && (
                        <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground">{selectedCustomerRecord.name}</p>
                          {selectedCustomerRecord.phone ? <p>Phone: {selectedCustomerRecord.phone}</p> : null}
                          <p>
                            Current Loan Balance: {shop?.currency} {Number(selectedCustomerRecord.outstanding_balance || 0).toLocaleString()}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant={paymentType === "cash" ? "default" : "outline"}
                          className="flex-1"
                          onClick={() => setPaymentType("cash")}
                          size="sm"
                        >
                          <Banknote className="mr-1 h-4 w-4" />
                          Cash
                        </Button>
                        <Button
                          variant={paymentType === "credit" ? "default" : "outline"}
                          className="flex-1"
                          onClick={() => {
                            if (!canUseCredit) {
                              toast({ variant: "destructive", title: "Select a Customer", description: "Loan sales require a registered customer." });
                              return;
                            }
                            setPaymentType("credit");
                          }}
                          size="sm"
                        >
                          <CreditCard className="mr-1 h-4 w-4" />
                          Loan
                        </Button>
                        <Button
                          variant={paymentType === "transfer" ? "default" : "outline"}
                          className="flex-1"
                          onClick={() => setPaymentType("transfer")}
                          size="sm"
                        >
                          <ArrowRightLeft className="mr-1 h-4 w-4" />
                          Transfer
                        </Button>
                      </div>

                      {paymentType === "credit" && (
                        <div className="space-y-1 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                          <p className="font-medium text-warning">Loan Sale</p>
                          <p className="text-xs text-muted-foreground">
                            Add the amount collected now, or leave empty for a full loan. The remaining balance will be saved automatically.
                          </p>
                        </div>
                      )}

                      {paymentType === "transfer" && (
                        <div className="space-y-3 rounded-lg border border-primary/20 bg-muted/30 p-3">
                          <p className="text-sm font-medium text-foreground">Transfer Details</p>

                          <div className="flex gap-2">
                            <Button
                              variant={transferDetails.transferType === "mobile" ? "default" : "outline"}
                              size="sm"
                              className="flex-1"
                              onClick={() => setTransferDetails({ ...transferDetails, transferType: "mobile" })}
                            >
                              Mobile Money
                            </Button>
                            <Button
                              variant={transferDetails.transferType === "bank" ? "default" : "outline"}
                              size="sm"
                              className="flex-1"
                              onClick={() => setTransferDetails({ ...transferDetails, transferType: "bank" })}
                            >
                              Bank Transfer
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <Label className="text-xs">
                                {transferDetails.transferType === "mobile" ? "Mobile Provider" : "Bank Name"} *
                              </Label>
                              <Input
                                placeholder={transferDetails.transferType === "mobile" ? "e.g. Orange Money" : "e.g. Sierra Leone Commercial Bank"}
                                value={transferDetails.providerName}
                                onChange={(e) => setTransferDetails({ ...transferDetails, providerName: e.target.value })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">
                                {transferDetails.transferType === "mobile" ? "Phone Number" : "Account Number"}
                              </Label>
                              <Input
                                placeholder={transferDetails.transferType === "mobile" ? "e.g. +232 76 000000" : "e.g. 0012345678"}
                                value={transferDetails.accountNumber}
                                onChange={(e) => setTransferDetails({ ...transferDetails, accountNumber: e.target.value })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Transaction Reference / ID *</Label>
                              <Input
                                placeholder="e.g. TXN-123456789"
                                value={transferDetails.transactionRef}
                                onChange={(e) => setTransferDetails({ ...transferDetails, transactionRef: e.target.value })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Sender Name *</Label>
                              <Input
                                placeholder="Name of person who sent payment"
                                value={transferDetails.senderName}
                                onChange={(e) => setTransferDetails({ ...transferDetails, senderName: e.target.value })}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <Input
                        type="number"
                        placeholder={paymentType === "credit" ? `Amount Collected Now (${shop?.currency}) - optional` : `Amount Paid (${shop?.currency})`}
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                      />

                      {(paymentType === "cash" || paymentType === "transfer") && changeAmount > 0 && (
                        <p className="text-sm font-medium text-primary">
                          Change Owed: {shop?.currency} {changeAmount.toLocaleString()}
                        </p>
                      )}

                      {paymentType === "credit" && (
                        <div className="space-y-1 rounded-lg border border-warning/30 bg-warning/10 p-3">
                          <p className="text-sm font-medium text-warning">
                            Loan Balance: {shop?.currency} {balanceDue.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            This balance will be added to the customer record and the Loans page.
                          </p>
                        </div>
                      )}

                      <Button
                        className="w-full"
                        size="lg"
                        onClick={handleCheckout}
                        disabled={isProcessing || cart.length === 0}
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        {isProcessing ? "Processing..." : "Complete Sale"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={receiptModalOpen} onOpenChange={setReceiptModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Receipt Ready - {receiptId}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-4 text-center">
              <div className="text-4xl">🧾</div>
              <p className="text-sm text-muted-foreground">
                Your sale has been completed successfully. Would you like to print or download the receipt?
              </p>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setReceiptModalOpen(false)} className="flex-1">
                <X className="mr-1 h-4 w-4" />
                Close
              </Button>
              <Button variant="outline" onClick={handleDownloadReceipt} className="flex-1">
                <Download className="mr-1 h-4 w-4" />
                Download
              </Button>
              <Button onClick={handlePrintReceipt} className="flex-1">
                <Printer className="mr-1 h-4 w-4" />
                Print
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <AlertDialog open={confirmOverpaymentOpen} onOpenChange={setConfirmOverpaymentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Accept overpayment?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The customer is paying {shop?.currency} {pendingCheckout?.changeAmount.toLocaleString() || 0} more than the sale total.
              If you continue, it will be saved in Change Owed so the shop can return it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelOverpayment}>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOverpayment}>Yes, accept</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

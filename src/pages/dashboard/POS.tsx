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
import { useShop } from "@/hooks/useShop";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CreditCard,
  Banknote,
  X,
  ArrowRightLeft,
  Download,
} from "lucide-react";
import { generateReceiptPDF, downloadPDF } from "@/lib/pdf";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

interface CartItem {
  product: Product;
  quantity: number;
}

interface TransferDetails {
  transferType: string; // "mobile" | "bank"
  providerName: string;
  accountNumber: string;
  transactionRef: string;
  senderName: string;
}

export default function POS() {
  const { shop } = useShop();
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string | null; address: string | null }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [paymentType, setPaymentType] = useState<string>("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Transfer details
  const [transferDetails, setTransferDetails] = useState<TransferDetails>({
    transferType: "mobile",
    providerName: "",
    accountNumber: "",
    transactionRef: "",
    senderName: "",
  });

  // Receipt modal
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptDoc, setReceiptDoc] = useState<any>(null);
  const [receiptId, setReceiptIdState] = useState("");

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
      .select("id, name, phone, address")
      .eq("shop_id", shop.id)
      .order("name");
    setCustomers(data || []);
  };

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [products, searchQuery]
  );

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= (product.quantity_on_hand || 0)) {
        toast({ variant: "destructive", title: "Insufficient Stock", description: `Only ${product.quantity_on_hand} available` });
        return;
      }
      setCart(cart.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      if ((product.quantity_on_hand || 0) <= 0) {
        toast({ variant: "destructive", title: "Out of Stock", description: `${product.name} is out of stock` });
        return;
      }
      setCart([...cart, { product, quantity: 1 }]);
    }
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

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0), [cart]);

  const generateReceiptId = () => {
    const prefix = (shop?.name || "ABAF").substring(0, 4).toUpperCase();
    const date = format(new Date(), "yyyyMMdd");
    const random = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}-${date}-${random}`;
  };

  const handleCheckout = async () => {
    if (!shop || !user || cart.length === 0) return;

    const paid = parseFloat(amountPaid) || 0;

    // Cash requires full payment
    if (paymentType === "cash" && paid < cartTotal) {
      toast({ variant: "destructive", title: "Insufficient Payment", description: `Amount paid (${paid}) is less than total (${cartTotal})` });
      return;
    }

    // Credit requires a registered customer
    if (paymentType === "credit" && (!selectedCustomer || selectedCustomer === "walkin")) {
      toast({ variant: "destructive", title: "Customer Required", description: "Please select a registered customer for credit sales" });
      return;
    }

    // Transfer requires full payment and details
    if (paymentType === "transfer") {
      if (paid < cartTotal) {
        toast({ variant: "destructive", title: "Insufficient Payment", description: "Transfer amount must cover the full total" });
        return;
      }
      if (!transferDetails.providerName || !transferDetails.transactionRef) {
        toast({ variant: "destructive", title: "Transfer Details Required", description: "Please fill in provider name and transaction reference" });
        return;
      }
    }

    setIsProcessing(true);

    try {
      const newReceiptId = generateReceiptId();

      // Build payment type label for storage
      const paymentLabel = paymentType === "transfer"
        ? `transfer-${transferDetails.transferType}`
        : paymentType;

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          shop_id: shop.id,
          staff_id: user.id,
          customer_id: selectedCustomer && selectedCustomer !== "walkin" ? selectedCustomer : null,
          total_amount: cartTotal,
          amount_paid: paid,
          payment_type: paymentLabel,
          receipt_id: newReceiptId,
          status: paymentType === "credit" && paid < cartTotal ? "partial" : "completed",
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.selling_price,
        total: item.product.selling_price * item.quantity,
      }));

      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
      if (itemsError) throw itemsError;

      // Update stock for each product
      for (const item of cart) {
        const newQty = (item.product.quantity_on_hand || 0) - item.quantity;
        await supabase.from("products").update({ quantity_on_hand: newQty }).eq("id", item.product.id);

        await supabase.from("stock_movements").insert({
          product_id: item.product.id,
          shop_id: shop.id,
          movement_type: "sale",
          quantity: -item.quantity,
          recorded_by: user.id,
          reference_id: sale.id,
          reference_type: "sale",
          notes: `Sale ${newReceiptId}`,
        });
      }

      // If credit sale, create loan
      if (paymentType === "credit" && selectedCustomer && selectedCustomer !== "walkin" && paid <= cartTotal) {
        await supabase.from("loans").insert({
          shop_id: shop.id,
          customer_id: selectedCustomer,
          sale_id: sale.id,
          total_amount: cartTotal,
          amount_paid: paid,
          status: paid > 0 ? "partial" : "unpaid",
        });

        // Update customer outstanding balance
        const balanceDue = cartTotal - paid;
        const customer = customers.find((c) => c.id === selectedCustomer);
        if (customer) {
          const { data: custData } = await supabase
            .from("customers")
            .select("outstanding_balance")
            .eq("id", selectedCustomer)
            .single();
          const currentBalance = custData?.outstanding_balance || 0;
          await supabase.from("customers").update({
            outstanding_balance: currentBalance + balanceDue,
          }).eq("id", selectedCustomer);
        }
      }

      // Generate receipt (don't auto-print, show in modal)
      const customer = customers.find((c) => c.id === selectedCustomer);
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
        customerName: customer?.name,
        customerPhone: customer?.phone || undefined,
        customerAddress: customer?.address || undefined,
        currency: shop.currency || "Le",
        footer: shop.receipt_footer || undefined,
        transferDetails: paymentType === "transfer" ? transferDetails : undefined,
      });

      setReceiptDoc(doc);
      setReceiptIdState(newReceiptId);
      setReceiptModalOpen(true);

      toast({ title: "Sale Completed!", description: `Receipt: ${newReceiptId}` });

      // Reset cart
      setCart([]);
      setAmountPaid("");
      setSelectedCustomer("");
      setPaymentType("cash");
      setTransferDetails({ transferType: "mobile", providerName: "", accountNumber: "", transactionRef: "", senderName: "" });
      fetchProducts();
    } catch (error) {
      console.error("Checkout error:", error);
      toast({ variant: "destructive", title: "Checkout Failed", description: error instanceof Error ? error.message : "An error occurred" });
    } finally {
      setIsProcessing(false);
    }
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-foreground">Point of Sale</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Product List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => addToCart(product)}
              >
                <CardContent className="p-3">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  {product.sku && <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-primary">
                      {shop?.currency} {product.selling_price.toLocaleString()}
                    </span>
                    <Badge variant={(product.quantity_on_hand || 0) <= (product.low_stock_level || 10) ? "destructive" : "secondary"} className="text-xs">
                      {product.quantity_on_hand}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                {searchQuery ? "No products match your search" : "No products in stock"}
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
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
                <p className="text-sm text-muted-foreground text-center py-4">Cart is empty. Click products to add.</p>
              ) : (
                <>
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {shop?.currency} {item.product.selling_price.toLocaleString()} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromCart(item.product.id)}>
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                      <span className="text-sm font-bold min-w-[60px] text-right">
                        {shop?.currency} {(item.product.selling_price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}

                  <div className="border-t pt-3 space-y-3">
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
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Payment Type Buttons */}
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
                          if (!selectedCustomer || selectedCustomer === "walkin") {
                            toast({ variant: "destructive", title: "Select a Customer", description: "Credit sales require a registered customer. Please select one from the dropdown above." });
                            return;
                          }
                          setPaymentType("credit");
                        }}
                        size="sm"
                      >
                        <CreditCard className="mr-1 h-4 w-4" />
                        Credit
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

                    {/* Credit info */}
                    {paymentType === "credit" && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm space-y-1">
                        <p className="font-medium text-amber-800 dark:text-amber-200">Credit Sale</p>
                        <p className="text-amber-700 dark:text-amber-300 text-xs">
                          Enter partial payment or leave empty for full credit. A loan will be created for the remaining balance.
                        </p>
                      </div>
                    )}

                    {/* Transfer form */}
                    {paymentType === "transfer" && (
                      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-3">
                        <p className="font-medium text-blue-800 dark:text-blue-200 text-sm">Transfer Details</p>
                        
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
                              placeholder={transferDetails.transferType === "mobile" ? "e.g. Orange Money, Africell" : "e.g. Sierra Leone Commercial Bank"}
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
                            <Label className="text-xs">Sender Name</Label>
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
                      placeholder={paymentType === "credit" ? `Partial Payment (${shop?.currency}) - optional` : `Amount Paid (${shop?.currency})`}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                    />

                    {paymentType === "cash" && parseFloat(amountPaid) > cartTotal && (
                      <p className="text-sm text-primary font-medium">
                        Change: {shop?.currency} {(parseFloat(amountPaid) - cartTotal).toLocaleString()}
                      </p>
                    )}

                    {paymentType === "credit" && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                        Balance Due: {shop?.currency} {(cartTotal - (parseFloat(amountPaid) || 0)).toLocaleString()}
                      </p>
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

      {/* Receipt Modal */}
      <Dialog open={receiptModalOpen} onOpenChange={setReceiptModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Receipt Ready - {receiptId}
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-4 space-y-2">
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
  );
}

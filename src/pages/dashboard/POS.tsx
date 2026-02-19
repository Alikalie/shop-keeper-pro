import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { generateReceiptPDF, downloadPDF, printPDF } from "@/lib/pdf";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

interface CartItem {
  product: Product;
  quantity: number;
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
    if (paymentType === "cash" && paid < cartTotal) {
      toast({ variant: "destructive", title: "Insufficient Payment", description: `Amount paid (${paid}) is less than total (${cartTotal})` });
      return;
    }

    setIsProcessing(true);

    try {
      const receiptId = generateReceiptId();

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          shop_id: shop.id,
          staff_id: user.id,
          customer_id: selectedCustomer || null,
          total_amount: cartTotal,
          amount_paid: paymentType === "credit" ? paid : paid,
          payment_type: paymentType,
          receipt_id: receiptId,
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

        // Record stock movement
        await supabase.from("stock_movements").insert({
          product_id: item.product.id,
          shop_id: shop.id,
          movement_type: "sale",
          quantity: -item.quantity,
          recorded_by: user.id,
          reference_id: sale.id,
          reference_type: "sale",
          notes: `Sale ${receiptId}`,
        });
      }

      // If credit sale, create loan
      if (paymentType === "credit" && selectedCustomer && paid < cartTotal) {
        await supabase.from("loans").insert({
          shop_id: shop.id,
          customer_id: selectedCustomer,
          sale_id: sale.id,
          total_amount: cartTotal,
          amount_paid: paid,
          status: paid > 0 ? "partial" : "unpaid",
        });
      }

      // Generate and print receipt
      const customer = customers.find((c) => c.id === selectedCustomer);
      const doc = generateReceiptPDF({
        shopName: shop.name,
        shopAddress: shop.address || undefined,
        shopPhone: shop.phone || undefined,
        shopLogoUrl: shop.logo_url || undefined,
        receiptId,
        date: format(new Date(), "PPpp"),
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.selling_price,
          total: item.product.selling_price * item.quantity,
        })),
        totalAmount: cartTotal,
        amountPaid: paid,
        paymentType,
        customerName: customer?.name,
        customerPhone: customer?.phone || undefined,
        customerAddress: customer?.address || undefined,
        currency: shop.currency || "Le",
        footer: shop.receipt_footer || undefined,
      });

      printPDF(doc);

      toast({ title: "Sale Completed!", description: `Receipt: ${receiptId}` });

      // Reset
      setCart([]);
      setAmountPaid("");
      setSelectedCustomer("");
      setPaymentType("cash");
      fetchProducts();
    } catch (error) {
      console.error("Checkout error:", error);
      toast({ variant: "destructive", title: "Checkout Failed", description: error instanceof Error ? error.message : "An error occurred" });
    } finally {
      setIsProcessing(false);
    }
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

                    <div className="flex gap-2">
                      <Button
                        variant={paymentType === "cash" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setPaymentType("cash")}
                      >
                        <Banknote className="mr-1 h-4 w-4" />
                        Cash
                      </Button>
                      <Button
                        variant={paymentType === "credit" ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setPaymentType("credit")}
                        disabled={!selectedCustomer || selectedCustomer === "walkin"}
                      >
                        <CreditCard className="mr-1 h-4 w-4" />
                        Credit
                      </Button>
                    </div>

                    <Input
                      type="number"
                      placeholder={`Amount Paid (${shop?.currency})`}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                    />

                    {paymentType === "cash" && parseFloat(amountPaid) > cartTotal && (
                      <p className="text-sm text-primary font-medium">
                        Change: {shop?.currency} {(parseFloat(amountPaid) - cartTotal).toLocaleString()}
                      </p>
                    )}

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleCheckout}
                      disabled={isProcessing || cart.length === 0}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      {isProcessing ? "Processing..." : "Complete Sale & Print"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

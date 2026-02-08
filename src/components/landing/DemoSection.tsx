import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DemoButton } from "./DemoButton";
import { Banknote, CreditCard, Package, BarChart3, ShoppingCart, Plus, Minus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type DemoMode = "cash" | "credit" | "stock" | "report";

const demoProducts = [
  { id: 1, name: "Rice (1 cup)", price: 400 },
  { id: 2, name: "Sugar (1 kg)", price: 350 },
  { id: 3, name: "Palm Oil (1L)", price: 800 },
];

interface CartItem {
  id: number;
  name: string;
  price: number;
  qty: number;
}

export function DemoSection() {
  const [mode, setMode] = useState<DemoMode>("cash");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);

  const addToCart = (product: typeof demoProducts[0]) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const completeSale = () => {
    setShowReceipt(true);
    setTimeout(() => {
      setShowReceipt(false);
      setCart([]);
    }, 3000);
  };

  return (
    <section className="py-20 bg-secondary/20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Try It Before You Sign Up
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Experience the POS system. Click products, complete a sale, see the receipt.
          </p>
        </motion.div>

        {/* Demo mode buttons */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <DemoButton
            label="Cash Sale"
            icon={Banknote}
            isActive={mode === "cash"}
            onClick={() => setMode("cash")}
          />
          <DemoButton
            label="Credit Sale"
            icon={CreditCard}
            isActive={mode === "credit"}
            onClick={() => setMode("credit")}
          />
          <DemoButton
            label="Stock Low"
            icon={Package}
            isActive={mode === "stock"}
            onClick={() => setMode("stock")}
          />
          <DemoButton
            label="Daily Report"
            icon={BarChart3}
            isActive={mode === "report"}
            onClick={() => setMode("report")}
          />
        </div>

        {/* Demo content */}
        <motion.div
          layout
          className="max-w-4xl mx-auto bg-card rounded-2xl border border-border shadow-lg overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {(mode === "cash" || mode === "credit") && (
              <motion.div
                key="pos"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6"
              >
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Products */}
                  <div>
                    <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                      Select Products
                    </h3>
                    <div className="space-y-3">
                      {demoProducts.map((product) => (
                        <motion.button
                          key={product.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => addToCart(product)}
                          className="w-full flex items-center justify-between p-4 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
                        >
                          <span className="font-medium text-foreground">{product.name}</span>
                          <span className="text-primary font-bold">Le {product.price}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Cart */}
                  <div>
                    <h3 className="font-semibold text-foreground mb-4">
                      Cart {mode === "credit" && <span className="text-warning">(Credit Sale)</span>}
                    </h3>
                    <div className="bg-muted/50 rounded-xl p-4 min-h-[200px]">
                      {cart.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                          Tap products to add them
                        </p>
                      ) : (
                        <>
                          <div className="space-y-3 mb-4">
                            {cart.map((item) => (
                              <div key={item.id} className="flex items-center justify-between">
                                <span className="text-foreground">{item.name}</span>
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => updateQty(item.id, -1)}
                                    className="w-8 h-8 rounded-lg bg-background flex items-center justify-center hover:bg-muted"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                  <span className="w-8 text-center font-medium">{item.qty}</span>
                                  <button
                                    onClick={() => updateQty(item.id, 1)}
                                    className="w-8 h-8 rounded-lg bg-background flex items-center justify-center hover:bg-muted"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                  <span className="w-20 text-right font-bold text-primary">
                                    Le {item.price * item.qty}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="border-t border-border pt-4">
                            <div className="flex justify-between text-lg font-bold mb-4">
                              <span>Total</span>
                              <span className="text-primary">Le {total.toLocaleString()}</span>
                            </div>
                            <Button onClick={completeSale} className="w-full" size="lg">
                              {mode === "credit" ? "Complete Credit Sale" : "Complete Cash Sale"}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Receipt popup */}
                <AnimatePresence>
                  {showReceipt && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
                    >
                      <div className="bg-card rounded-2xl border shadow-2xl p-6 max-w-sm">
                        <div className="flex items-center justify-center gap-2 text-success mb-4">
                          <CheckCircle2 className="h-6 w-6" />
                          <span className="font-bold">Sale Complete!</span>
                        </div>
                        <div className="font-mono text-sm text-muted-foreground border rounded-lg p-4 bg-muted/50">
                          <p className="text-center font-bold text-foreground border-b pb-2 mb-2">
                            DEMO SHOP
                          </p>
                          {cart.map((item) => (
                            <p key={item.id}>
                              {item.name} x{item.qty} ... Le {item.price * item.qty}
                            </p>
                          ))}
                          <p className="border-t pt-2 mt-2 font-bold text-primary">
                            TOTAL: Le {total}
                          </p>
                          {mode === "credit" && (
                            <p className="text-warning">Payment: CREDIT</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {mode === "stock" && (
              <motion.div
                key="stock"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6"
              >
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-warning" />
                  Stock Alerts
                </h3>
                <div className="space-y-3">
                  {[
                    { name: "Flour", qty: 5, level: "low" },
                    { name: "Milk Powder", qty: 2, level: "critical" },
                    { name: "Cooking Oil", qty: 12, level: "ok" },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        item.level === "critical"
                          ? "border-destructive bg-destructive/5"
                          : item.level === "low"
                          ? "border-warning bg-warning/5"
                          : "border-border bg-muted/50"
                      }`}
                    >
                      <span className="font-medium">{item.name}</span>
                      <span
                        className={`font-bold ${
                          item.level === "critical"
                            ? "text-destructive"
                            : item.level === "low"
                            ? "text-warning"
                            : "text-success"
                        }`}
                      >
                        {item.qty} left
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {mode === "report" && (
              <motion.div
                key="report"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6"
              >
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Daily Sales Report
                </h3>
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div className="bg-success/10 rounded-xl p-4">
                    <p className="text-sm text-muted-foreground">Total Sales</p>
                    <p className="text-2xl font-bold text-success">Le 45,600</p>
                  </div>
                  <div className="bg-primary/10 rounded-xl p-4">
                    <p className="text-sm text-muted-foreground">Transactions</p>
                    <p className="text-2xl font-bold text-primary">43</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-muted rounded-xl p-4">
                    <p className="text-sm text-muted-foreground">Cash Sales</p>
                    <p className="text-xl font-bold text-foreground">Le 32,100</p>
                  </div>
                  <div className="bg-warning/10 rounded-xl p-4">
                    <p className="text-sm text-muted-foreground">Credit Sales</p>
                    <p className="text-xl font-bold text-warning">Le 13,500</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
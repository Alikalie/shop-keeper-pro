import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Receipt, Package, BarChart3 } from "lucide-react";

interface Message {
  id: number;
  type: "customer" | "shop" | "system";
  text: string;
  icon?: React.ReactNode;
}

const scenarios: Message[][] = [
  [
    { id: 1, type: "customer", text: "Good morning, how much is rice?" },
    { id: 2, type: "shop", text: "Le 400 per cup." },
    { id: 3, type: "customer", text: "Give me 3 cups." },
    { id: 4, type: "system", text: "Sale recorded", icon: <CheckCircle2 className="h-4 w-4" /> },
    { id: 5, type: "system", text: "Receipt printed", icon: <Receipt className="h-4 w-4" /> },
    { id: 6, type: "system", text: "Stock updated", icon: <Package className="h-4 w-4" /> },
  ],
  [
    { id: 1, type: "customer", text: "I want 2 bags of sugar on credit." },
    { id: 2, type: "shop", text: "That's Le 800. I'll add it to your account." },
    { id: 3, type: "system", text: "Credit sale recorded", icon: <CheckCircle2 className="h-4 w-4" /> },
    { id: 4, type: "system", text: "Customer balance: Le 2,400", icon: <BarChart3 className="h-4 w-4" /> },
    { id: 5, type: "system", text: "Receipt printed", icon: <Receipt className="h-4 w-4" /> },
  ],
  [
    { id: 1, type: "system", text: "⚠️ Low stock alert: Flour", icon: <Package className="h-4 w-4" /> },
    { id: 2, type: "shop", text: "Let me check the inventory..." },
    { id: 3, type: "system", text: "Flour: Only 5 bags left", icon: <Package className="h-4 w-4" /> },
    { id: 4, type: "shop", text: "Time to reorder from supplier!" },
    { id: 5, type: "system", text: "Stock order reminder set", icon: <CheckCircle2 className="h-4 w-4" /> },
  ],
  [
    { id: 1, type: "shop", text: "End of day! Let me see the report." },
    { id: 2, type: "system", text: "Generating daily report...", icon: <BarChart3 className="h-4 w-4" /> },
    { id: 3, type: "system", text: "Total Sales: Le 45,600", icon: <CheckCircle2 className="h-4 w-4" /> },
    { id: 4, type: "system", text: "Cash: Le 32,100 | Credit: Le 13,500", icon: <BarChart3 className="h-4 w-4" /> },
    { id: 5, type: "system", text: "Report ready to print!", icon: <Receipt className="h-4 w-4" /> },
  ],
];

export function ChatConversation() {
  const [currentScenario, setCurrentScenario] = useState(0);
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const scenario = scenarios[currentScenario];

    if (messageIndex < scenario.length) {
      const timer = setTimeout(() => {
        setVisibleMessages((prev) => [...prev, scenario[messageIndex]]);
        setMessageIndex((prev) => prev + 1);
      }, 1200);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setVisibleMessages([]);
        setMessageIndex(0);
        setCurrentScenario((prev) => (prev + 1) % scenarios.length);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [messageIndex, currentScenario]);

  return (
    <div className="relative bg-card rounded-2xl border border-border shadow-lg p-4 min-h-[320px] max-w-md mx-auto">
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
        <span className="text-xs text-muted-foreground font-medium">Live Demo</span>
      </div>

      <div className="pt-8 space-y-3">
        <AnimatePresence mode="popLayout">
          {visibleMessages.map((message) => (
            <motion.div
              key={`${currentScenario}-${message.id}`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`flex ${message.type === "customer" ? "justify-start" : message.type === "shop" ? "justify-end" : "justify-center"}`}
            >
              {message.type === "system" ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-success/10 text-success rounded-full text-sm font-medium">
                  {message.icon}
                  <span>{message.text}</span>
                </div>
              ) : (
                <div
                  className={`px-4 py-2.5 rounded-2xl max-w-[80%] ${
                    message.type === "customer"
                      ? "bg-muted text-foreground rounded-bl-md"
                      : "bg-primary text-primary-foreground rounded-br-md"
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Scenario indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {scenarios.map((_, index) => (
          <div
            key={index}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === currentScenario ? "w-6 bg-primary" : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
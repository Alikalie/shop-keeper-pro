import { motion } from "framer-motion";
import { WifiOff, CheckCircle2, Receipt, Database } from "lucide-react";

export function OfflineIndicator() {
  const features = [
    { icon: Receipt, text: "Receipts print offline" },
    { icon: Database, text: "Sales saved locally" },
    { icon: CheckCircle2, text: "Syncs when online" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6 }}
      className="relative bg-gradient-to-br from-card to-secondary/30 rounded-2xl border border-border p-8 overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl" />

      <div className="relative flex flex-col md:flex-row items-center gap-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <WifiOff className="h-8 w-8 text-destructive" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive"
            />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Works Offline</h3>
            <p className="text-muted-foreground text-sm">No internet? No problem.</p>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.text}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="flex items-center gap-3 bg-background/50 rounded-xl px-4 py-3"
            >
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                <feature.icon className="h-4 w-4 text-success" />
              </div>
              <span className="text-sm font-medium text-foreground">{feature.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
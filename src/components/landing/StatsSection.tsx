import { motion } from "framer-motion";
import { AnimatedCounter } from "./AnimatedCounter";
import { Banknote, Receipt, Users, AlertTriangle } from "lucide-react";

export function StatsSection() {
  return (
    <section className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl font-bold text-foreground mb-2">Real-Time Demo Metrics</h2>
          <p className="text-muted-foreground">See how NE-SHOP tracks your business</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AnimatedCounter
            label="Sales Today"
            value={5600}
            prefix="Le "
            icon={Banknote}
            color="success"
            delay={0}
          />
          <AnimatedCounter
            label="Receipts Printed"
            value={43}
            icon={Receipt}
            color="primary"
            delay={200}
          />
          <AnimatedCounter
            label="Customers Owing"
            value={7}
            icon={Users}
            color="warning"
            delay={400}
          />
          <AnimatedCounter
            label="Stock Alerts"
            value={2}
            icon={AlertTriangle}
            color="accent"
            delay={600}
          />
        </div>
      </div>
    </section>
  );
}
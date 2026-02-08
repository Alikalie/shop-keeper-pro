import { motion } from "framer-motion";
import { FeatureCard } from "./FeatureCard";
import { Package, Receipt, Users, CreditCard, BarChart3, UserCheck } from "lucide-react";

const features = [
  {
    title: "Track Inventory",
    description: "Know exactly what's in stock. Get alerts when items run low. Never miss a sale.",
    icon: Package,
  },
  {
    title: "Print Receipts",
    description: "Professional receipts with your shop name. PDF or print to any printer.",
    icon: Receipt,
  },
  {
    title: "Manage Staff",
    description: "Add sales workers. Track who sold what. See individual performance.",
    icon: UserCheck,
  },
  {
    title: "Control Credit Sales",
    description: "Know who owes you money. Track payments. Customer credit history.",
    icon: CreditCard,
  },
  {
    title: "See Daily Reports",
    description: "Total sales, cash vs credit, hourly breakdown. Print end-of-day reports.",
    icon: BarChart3,
  },
  {
    title: "Customer Directory",
    description: "Keep customer info organized. View purchase history and outstanding balances.",
    icon: Users,
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Everything You Need to Run Your Shop
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Simple tools that work. No complicated setup. Start selling in minutes.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
              delay={index * 0.1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
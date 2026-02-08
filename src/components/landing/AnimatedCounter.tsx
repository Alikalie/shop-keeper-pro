import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface AnimatedCounterProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: LucideIcon;
  color: "primary" | "accent" | "success" | "warning";
  delay?: number;
}

export function AnimatedCounter({
  label,
  value,
  prefix = "",
  suffix = "",
  icon: Icon,
  color,
  delay = 0,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true);
      const duration = 1500;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.floor(value * easeOut));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString("en-US");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isAnimating ? 1 : 0, y: isAnimating ? 0 : 20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center gap-3 p-4"
    >
      <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-foreground">
          {prefix}
          {formatNumber(displayValue)}
          {suffix}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </div>
    </motion.div>
  );
}
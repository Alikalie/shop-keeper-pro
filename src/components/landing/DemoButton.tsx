import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface DemoButtonProps {
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onClick: () => void;
}

export function DemoButton({ label, icon: Icon, isActive, onClick }: DemoButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        isActive
          ? "bg-primary text-primary-foreground shadow-md"
          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute inset-0 rounded-xl bg-primary -z-10"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
    </motion.button>
  );
}
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { ChatConversation } from "./ChatConversation";
import { Link } from "react-router-dom";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 pb-12 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/50 via-background to-background" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

      <div className="container relative mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium mb-6"
            >
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              Made for Sierra Leone shops
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight mb-6"
            >
              Manage Your Shop.
              <br />
              <span className="text-primary">Track Sales.</span>
              <br />
              <span className="bg-gradient-to-r from-accent to-warning bg-clip-text text-transparent">
                No Stress.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-8"
            >
              The complete POS system for your retail business. Sell fast, print receipts, know who owes you, and see your daily reports — even when internet fails.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button asChild size="lg" className="text-base font-semibold px-8 shadow-lg hover:shadow-xl transition-shadow">
                <Link to="/signup">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-base font-medium">
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </motion.div>
          </motion.div>

          {/* Right content - Chat demo */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            className="relative"
          >
            <ChatConversation />
            
            {/* Floating receipt decoration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
              animate={{ opacity: 1, scale: 1, rotate: -5 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="absolute -bottom-4 -right-4 lg:right-0 bg-card rounded-xl border border-border p-3 shadow-xl max-w-[180px]"
            >
              <div className="text-xs font-mono text-muted-foreground space-y-1">
                <p className="text-foreground font-bold text-center border-b pb-1">RECEIPT</p>
                <p>Rice x3 ........Le 1,200</p>
                <p className="text-primary font-bold pt-1 border-t">TOTAL: Le 1,200</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
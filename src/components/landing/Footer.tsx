import { Store } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-foreground py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Store className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-background">ABAF-SHOP</span>
          </div>

          <p className="text-background/60 text-sm text-center">
            © 2026 ABAF-SHOP. Made with ❤️ for Sierra Leone retailers.
          </p>

          <div className="flex items-center gap-6">
            <a href="#" className="text-background/60 hover:text-background text-sm transition-colors">
              Privacy
            </a>
            <a href="#" className="text-background/60 hover:text-background text-sm transition-colors">
              Terms
            </a>
            <a href="#" className="text-background/60 hover:text-background text-sm transition-colors">
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
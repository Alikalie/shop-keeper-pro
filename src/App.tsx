import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import DashboardHome from "./pages/dashboard/DashboardHome";
import Products from "./pages/dashboard/Products";
import Categories from "./pages/dashboard/Categories";
import Customers from "./pages/dashboard/Customers";
import SalesHistory from "./pages/dashboard/SalesHistory";
import Loans from "./pages/dashboard/Loans";
import POS from "./pages/dashboard/POS";
import Reports from "./pages/dashboard/Reports";
import UserManagement from "./pages/dashboard/UserManagement";
import WebsiteSettings from "./pages/dashboard/WebsiteSettings";
import ShopSettings from "./pages/dashboard/ShopSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            
            {/* Protected Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardHome />} />
              <Route path="pos" element={<POS />} />
              <Route path="products" element={<Products />} />
              <Route path="categories" element={<Categories />} />
              <Route path="customers" element={<Customers />} />
              <Route path="sales" element={<SalesHistory />} />
              <Route path="loans" element={<Loans />} />
              <Route path="reports" element={<Reports />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="website" element={<WebsiteSettings />} />
              <Route path="settings" element={<ShopSettings />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import ExpressRoutes from "@/components/ExpressRoutes";
import Navbar from "@/components/Navbar";

const queryClient = new QueryClient();

export default function App() {
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider><AuthProvider><BrowserRouter><ErrorBoundary>
      <div className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20 selection:text-primary">
        <Navbar />
        <Suspense fallback={<p role="status" className="container pt-28">Loading page…</p>}>
          <ExpressRoutes />
        </Suspense>
        <Toaster /><Sonner />
      </div>
    </ErrorBoundary></BrowserRouter></AuthProvider></TooltipProvider>
  </QueryClientProvider>;
}

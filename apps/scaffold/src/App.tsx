import { Suspense } from "react";
import { BrowserRouter, useRoutes } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PreviewNavigationReporter } from "@/components/PreviewNavigationReporter";
import { ToasterProvider } from "@/components/ui/use-toast";
import { AuthProvider } from "@/features/auth";
import { AppLayout } from "@/layouts/AppLayout";
import { routes } from "@/routes";

function AppRoutes() {
  const element = useRoutes(routes);
  return <AppLayout>{element}</AppLayout>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToasterProvider>
        <AuthProvider>
          <BrowserRouter>
            <PreviewNavigationReporter />
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
              <AppRoutes />
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ToasterProvider>
    </ErrorBoundary>
  );
}

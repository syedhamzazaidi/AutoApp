import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { ProtectedAdminRoute } from "@/features/admin/rbac/ProtectedAdminRoute";

const IndexPage = lazy(() => import("@/pages/Index"));
const NotFoundPage = lazy(() => import("@/pages/NotFound"));
const LoginPage = lazy(() => import("@/features/auth/pages/Login"));
const SignupPage = lazy(() => import("@/features/auth/pages/Signup"));
const AnalyzePage = lazy(() => import("@/pages/AnalyzePage"));
const HistoryPage = lazy(() => import("@/pages/HistoryPage"));
const AdminDashboard = lazy(() =>
  import("@/features/admin/AdminDashboard").then((m) => ({ default: m.AdminDashboard })),
);

export const routes: RouteObject[] = [
  { path: "/", element: <IndexPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/analyze", element: <AnalyzePage /> },
  { path: "/history", element: <HistoryPage /> },
  {
    path: "/admin",
    element: (
      <ProtectedAdminRoute>
        <AdminDashboard />
      </ProtectedAdminRoute>
    ),
  },
  { path: "*", element: <NotFoundPage /> },
];

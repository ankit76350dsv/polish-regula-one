import { createBrowserRouter } from "react-router-dom";

import Layout from "../components/layout/Layout";
import Login from "../components/Login";
import SsoCallback from "../components/SsoCallback";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";

import Dashboard from "../pages/Dashboard";
import Companies from "../pages/Companies";
import CompanyForm from "../pages/CompanyForm";
import WasteEntries from "../pages/WasteEntries";
import Reports from "../pages/Reports";
import ReportDetail from "../pages/ReportDetail";
import Thresholds from "../pages/Thresholds";
import AuditLogs from "../pages/AuditLogs";
import NotFound from "../pages/NotFound";

const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [{ path: "/login", element: <Login /> }],
  },
  {
    // SSO callback — where the central RegulaOne login returns the user to.
    path: "/auth/sso-callback",
    element: <SsoCallback />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <Layout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: "companies", element: <Companies /> },
          { path: "companies/new", element: <CompanyForm /> },
          { path: "companies/:id/edit", element: <CompanyForm /> },
          { path: "waste-entries", element: <WasteEntries /> },
          { path: "reports", element: <Reports /> },
          { path: "reports/:id", element: <ReportDetail /> },
          { path: "thresholds", element: <Thresholds /> },
          { path: "audit-logs", element: <AuditLogs /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

export default router;

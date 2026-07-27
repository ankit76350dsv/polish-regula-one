import { createBrowserRouter } from "react-router-dom";

import Layout from "../components/layout/Layout";
import Login from "../components/Login";
import SsoCallback from "../components/SsoCallback";

import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";

import Clock from "../pages/Clock";
import MyTimesheet from "../pages/MyTimesheet";
import Absences from "../pages/Absences";
import TimeRecords from "../pages/TimeRecords";
import Dashboard from "../pages/Dashboard";
import Policy from "../pages/Policy";
import AuditReport from "../pages/AuditReport";
import NotFound from "../pages/NotFound";

const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [{ path: "/login", element: <Login /> }],
  },
  {
    // SSO callback — where central RegulaOne login returns the user.
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
          { index: true, element: <Clock /> },
          { path: "my-timesheet", element: <MyTimesheet /> },
          { path: "absences", element: <Absences /> },
          { path: "records", element: <TimeRecords /> },
          { path: "dashboard", element: <Dashboard /> },
          { path: "policy", element: <Policy /> },
          { path: "audit-logs", element: <AuditReport /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

export default router;

import { createBrowserRouter } from "react-router-dom";

import Layout from "../components/layout/Layout";
import Home from "../pages/Home";
import Dashboard from "../pages/Dashboard";
import Placeholder from "../pages/Placeholder";
import Login from "../components/Login";

import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import EmployeeList from "../components/EmployeeList";
import AddEmployee from "../components/AddEmployee";

const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      {
        path: "/login",
        element: <Login />,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <Layout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: "dashboard", element: <Home /> },
           { path: "employees", element: <EmployeeList /> },
             { path: "/employees/add", element: <AddEmployee /> },
          { path: "services", element: <Placeholder /> },
          { path: "services/compliance-audits", element: <Placeholder /> },
          { path: "services/risk-assessment", element: <Placeholder /> },
          { path: "services/safety-training", element: <Placeholder /> },
          { path: "services/incident-management", element: <Placeholder /> },

          { path: "solutions", element: <Placeholder /> },
          { path: "solutions/enterprise", element: <Placeholder /> },
          { path: "solutions/smb", element: <Placeholder /> },
          { path: "solutions/construction", element: <Placeholder /> },

          { path: "reports", element: <Placeholder /> },
          { path: "contact", element: <Placeholder /> },
          { path: "privacy", element: <Placeholder /> },
          { path: "terms", element: <Placeholder /> },

          { path: "*", element: <Placeholder /> },
        ],
      },
    ],
  },
]);

export default router;
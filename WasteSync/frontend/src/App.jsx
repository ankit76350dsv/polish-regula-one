import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import router from "./routes/AppRoutes";

// The AuthProvider checks the shared SSO cookie on load and exposes the user.
// The RouterProvider then renders the right page based on the URL.
export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

import { createContext, useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { getMe, logoutUser, redirectToCentralLogin } from "../api/authApi";
import { setAuthUser, clearAuthUser } from "../store/slices/authSlice";

const AuthContext = createContext(null);

// AuthProvider uses the SSO model — same as SafeWork / KSeFFlow.
// There is no email/password login here. We only:
//   - check the shared auth cookie by calling /api/auth/me (checkAuth)
//   - send the user to the central RegulaOne login page (login)
//   - clear the cookie and return to the central login page (logout)
export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [error, setError] = useState("");

  const checkAuth = async () => {
    try {
      setAuthChecking(true);
      const userData = await getMe();
      setUser(userData);
      // Mirror the user into Redux so any component can read it via useSelector.
      dispatch(setAuthUser(userData));
      setError("");
      return userData;
    } catch (err) {
      setUser(null);
      dispatch(clearAuthUser());
      return null;
    } finally {
      setAuthChecking(false);
    }
  };

  // Start the SSO login flow by redirecting to the central RegulaOne login page.
  const login = () => {
    redirectToCentralLogin();
  };

  const logout = async () => {
    const logoutUrl = await logoutUser();
    setUser(null);
    dispatch(clearAuthUser());
    window.location.href = logoutUrl;
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    authChecking,
    error,
    setError,
    checkAuth,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};

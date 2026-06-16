import { createContext, useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import {
  getMe,
  logoutUser,
  redirectToCentralLogin,
} from "../api/authApi";
import { setAuthUser, clearAuthUser } from "../store/slices/authSlice";

const AuthContext = createContext(null);

// AuthProvider now uses the SSO (single sign-on) model — same as KSeFFlow.
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
      // Mirror user into Redux so any component can access it via
      // useSelector(state => state.auth.user) without needing the context
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
  // The actual password check happens there, not in SafeWork.
  const login = () => {
    redirectToCentralLogin();
  };

  const logout = async () => {
    // Ask the RegulaOne backend to clear the shared auth cookie, then clear
    // our local UI state and send the user to the central login page.
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

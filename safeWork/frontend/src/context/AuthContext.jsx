import { createContext, useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { getMe, loginUser, logoutUser } from "../api/authApi";
import { setAuthUser, clearAuthUser } from "../store/slices/authSlice";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
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

  const login = async ({ email, password }) => {
    try {
      setLoginLoading(true);
      setError("");

      await loginUser({ email, password });

      // Important: after login, call /me again to get actual user data
      const userData = await getMe();

      setUser(userData);
      // Mirror user into Redux after successful login
      dispatch(setAuthUser(userData));
      return userData;
    } catch (err) {
      setUser(null);
      dispatch(clearAuthUser());
      setError(err.message || "Login failed");
      throw err;
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    logoutUser();
    setUser(null);
    // Clear user from Redux on logout
    dispatch(clearAuthUser());
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    authChecking,
    loginLoading,
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
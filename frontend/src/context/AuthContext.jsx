import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const data = await api.getMe();
      setUser(data);
    } catch (err) {
      setUser(null);
      localStorage.removeItem("trustvault_token");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email, password, captchaToken) => {
    const res = await api.login({ email, password, captcha_token: captchaToken });
    if (res.access_token) {
      localStorage.setItem("trustvault_token", res.access_token);
    }
    setUser(res.user);
    return res;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // Ignore errors on logout
    } finally {
      localStorage.removeItem("trustvault_token");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser: fetchCurrentUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem("aof_user");
    return u ? JSON.parse(u) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("aof_token") && !user) {
      setLoading(true);
      api.get("/auth/me")
        .then((r) => {
          setUser(r.data);
          localStorage.setItem("aof_user", JSON.stringify(r.data));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line

  const login = async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    localStorage.setItem("aof_token", r.data.token);
    localStorage.setItem("aof_user", JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = () => {
    localStorage.removeItem("aof_token");
    localStorage.removeItem("aof_user");
    setUser(null);
    window.location.href = "/login";
  };

  const has = (perm) => !!user?.permissions?.includes(perm);

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, has }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

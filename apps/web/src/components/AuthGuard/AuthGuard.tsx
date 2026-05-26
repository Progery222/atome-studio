import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../stores/auth";

export function AuthGuard() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    if (!ready) hydrate();
  }, [ready, hydrate]);

  if (!ready && !token && !user) return null;
  if (!token && !user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

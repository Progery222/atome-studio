import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../stores/auth";

/** Passes through if user has required role, otherwise redirects to / */
export function RoleGuard({ roles }: { roles: string[] }) {
  const role = useAuthStore((s) => s.role);
  if (!roles.includes(role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

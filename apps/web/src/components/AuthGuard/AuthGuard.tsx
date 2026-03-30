import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'

export function AuthGuard() {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

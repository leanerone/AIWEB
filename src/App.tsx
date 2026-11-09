import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { Layout } from './components/Layout'
import { useAssistant } from './stores/assistant'
import { useAuth } from './stores/auth'
import { Briefings } from './pages/Briefings'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { Memos } from './pages/Memos'
import { Resources } from './pages/Resources'
import { ResourceDetail } from './pages/ResourceDetail'
import { Settings } from './pages/Settings'

function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <>{children}</>
}

/** /chat 已退役为悬浮助手：旧链接进入时自动展开助手并回到首页 */
function AssistantRedirect() {
  useEffect(() => { useAssistant.getState().setOpen(true) }, [])
  return <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/resources/:id" element={<ResourceDetail />} />
        <Route path="/memos" element={<Memos />} />
        <Route path="/chat" element={<AssistantRedirect />} />
        <Route path="/briefings" element={<Briefings />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

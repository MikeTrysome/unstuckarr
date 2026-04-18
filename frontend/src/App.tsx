import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import Login from './pages/Login'
import Logs from './pages/Logs'
import Queue from './pages/Queue'
import Setup from './pages/Setup'
import Connections from './pages/settings/Connections'
import Detection from './pages/settings/Detection'
import Notifications from './pages/settings/Notifications'
import Account from './pages/settings/Account'
import { isAuthenticated } from './lib/auth'

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/events" element={<Events />} />
          <Route path="/logs" element={<Logs />} />
          {/* Settings routes */}
          <Route path="/connections" element={<Connections />} />
          <Route path="/detection" element={<Detection />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/account" element={<Account />} />
          {/* Legacy redirect — old /settings URL */}
          <Route path="/settings" element={<Navigate to="/connections" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getToken } from './lib/api'
import Layout from './components/Layout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Devices from './pages/Devices'
import DeviceDetail from './pages/DeviceDetail'
import Tasks from './pages/Tasks'
import TaskDetail from './pages/TaskDetail'
import TaskNew from './pages/TaskNew'
import Schedules from './pages/Schedules'
import ScheduleNew from './pages/ScheduleNew'
import Workflows from './pages/Workflows'
import WorkflowNew from './pages/WorkflowNew'
import WorkflowRunDetail from './pages/WorkflowRunDetail'
import Groups from './pages/Groups'
import GroupNew from './pages/GroupNew'
import Monitoring from './pages/Monitoring'
import AlertRules from './pages/AlertRules'
import Alerts from './pages/Alerts'
import HealthChecks from './pages/HealthChecks'
import Templates from './pages/Templates'
import Webhooks from './pages/Webhooks'
import Triggers from './pages/Triggers'
import Reports from './pages/Reports'
import './index.css'

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />
  return <>{children}</>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Overview />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/devices/:id" element={<DeviceDetail />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/new" element={<TaskNew />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/schedules/new" element={<ScheduleNew />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/workflows/new" element={<WorkflowNew />} />
          <Route path="/workflow-runs/:runId" element={<WorkflowRunDetail />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/groups/new" element={<GroupNew />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/alert-rules" element={<AlertRules />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/health-checks" element={<HealthChecks />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/webhooks" element={<Webhooks />} />
          <Route path="/triggers" element={<Triggers />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)

import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearToken } from '../lib/api'

const navItems = [
  { path: '/', label: 'Overview' },
  { path: '/devices', label: 'Devices' },
  { path: '/tasks', label: 'Tasks' },
  { path: '/schedules', label: 'Schedules' },
  { path: '/workflows', label: 'Workflows' },
  { path: '/groups', label: 'Groups' },
  { path: '/monitoring', label: 'Monitoring' },
  { path: '/alert-rules', label: 'Alert Rules' },
  { path: '/alerts', label: 'Alerts' },
  { path: '/health-checks', label: 'Health Checks' },
  { path: '/templates', label: 'Templates' },
  { path: '/webhooks', label: 'Webhooks' },
  { path: '/triggers', label: 'Triggers' },
  { path: '/reports', label: 'Reports' }
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  function handleLogout() {
    clearToken()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm font-semibold tracking-wide text-white">
              Open Hive
            </Link>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    location.pathname === item.path
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

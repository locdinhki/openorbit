import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearToken, getUser } from '../lib/api'

interface NavGroup {
  label: string
  items: { path: string; label: string; adminOnly?: boolean }[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { path: '/', label: 'Overview' },
      { path: '/devices', label: 'Devices' },
      { path: '/groups', label: 'Groups' }
    ]
  },
  {
    label: 'Automation',
    items: [
      { path: '/tasks', label: 'Tasks' },
      { path: '/schedules', label: 'Schedules' },
      { path: '/workflows', label: 'Workflows' },
      { path: '/templates', label: 'Templates' },
      { path: '/triggers', label: 'Triggers' }
    ]
  },
  {
    label: 'Observability',
    items: [
      { path: '/monitoring', label: 'Monitoring' },
      { path: '/alert-rules', label: 'Alert Rules' },
      { path: '/alerts', label: 'Alerts' },
      { path: '/health-checks', label: 'Health Checks' },
      { path: '/reports', label: 'Reports' }
    ]
  },
  {
    label: 'Integrations',
    items: [{ path: '/webhooks', label: 'Webhooks' }]
  },
  {
    label: 'Settings',
    items: [
      { path: '/users', label: 'Users', adminOnly: true },
      { path: '/audit-log', label: 'Audit Log', adminOnly: true }
    ]
  }
]

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const user = getUser()

  function toggleGroup(label: string) {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/'
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  function handleLogout() {
    clearToken()
    navigate('/login')
  }

  const isAdmin = user?.role === 'admin'

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'text-red-400',
      operator: 'text-blue-400',
      viewer: 'text-gray-500'
    }
    return <span className={`text-[10px] ${colors[role] ?? colors.viewer}`}>{role}</span>
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col fixed inset-y-0 left-0 z-20">
        {/* Branding */}
        <div className="h-14 flex items-center px-5 border-b border-gray-800">
          <Link to="/" className="text-sm font-semibold tracking-wide text-white">
            Open Hive
          </Link>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => !item.adminOnly || isAdmin)
            if (visibleItems.length === 0) return null

            const isOpen = !collapsed[group.label]
            return (
              <div key={group.label} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {group.label}
                  <ChevronIcon open={isOpen} />
                </button>
                {isOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    {visibleItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`block px-3 py-1.5 text-xs rounded-md transition-colors ${
                          isActive(item.path)
                            ? 'bg-gray-800 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* User info + Logout */}
        <div className="border-t border-gray-800 px-5 py-3">
          {user && user.username !== 'api-key' && (
            <div className="mb-2">
              <p className="text-xs text-gray-300">{user.username}</p>
              {roleBadge(user.role)}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 ml-56 px-6 py-6 max-w-5xl">
        <Outlet />
      </main>
    </div>
  )
}

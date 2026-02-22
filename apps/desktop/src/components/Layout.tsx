import { useState, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  List,
  BarChart2,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import SettingsModal from './SettingsModal'

interface MenuItem {
  icon: LucideIcon
  labelKey: string
  to: string
}

const menuItems: MenuItem[] = [
  { to: '/',          icon: LayoutDashboard, labelKey: 'menu.overview'  },
  { to: '/list',      icon: List,            labelKey: 'menu.list'      },
  { to: '/analytics', icon: BarChart2,       labelKey: 'menu.analytics' },
]

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { t } = useTranslation()
  const { location } = useRouterState()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      {/* 拖动区域 */}
      <div
        className="h-10 w-full shrink-0 select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      <div className="drawer drawer-open flex-1 overflow-hidden">
        <input id="main-drawer" type="checkbox" className="drawer-toggle" />

        {/* 右侧内容区 */}
        <div className="drawer-content flex flex-col overflow-auto">
          {children}
        </div>

        {/* 左侧侧边栏 */}
        <div className="drawer-side border-r border-base-300 h-full">
          <label htmlFor="main-drawer" className="drawer-overlay" />
          <aside className="bg-base-200 w-56 flex flex-col h-full">

            {/* 应用名 */}
            <div className="px-4 py-3 text-xs font-semibold text-base-content/50 uppercase tracking-widest">
              {t('common.appName')}
            </div>

            {/* 菜单 */}
            <ul className="menu bg-base-200 flex-1 px-2 w-full">
              {menuItems.map(({ to, icon: Icon, labelKey }) => {
                const isActive = location.pathname === to
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      className={isActive ? 'menu-active' : ''}
                    >
                      <Icon size={16} />
                      {t(labelKey)}
                    </Link>
                  </li>
                )
              })}
            </ul>

            {/* 底部：Settings 弹框触发 */}
            <div className="p-2 border-t border-base-300">
              <button
                className="flex items-center gap-2 w-full rounded-lg px-2 py-2 transition-colors hover:bg-base-300 text-left"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={16} />
                <span className="text-sm">{t('menu.settings')}</span>
              </button>
            </div>

            <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

          </aside>
        </div>
      </div>
    </>
  )
}

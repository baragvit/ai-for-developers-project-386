import { CalendarClock } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Записаться', shortLabel: 'Записаться', end: true },
  { to: '/admin', label: 'Кабинет владельца', shortLabel: 'Кабинет', end: false },
]

export function Layout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <CalendarClock className="size-5" />
            </span>
            <span className="text-lg">Созвон</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-accent text-accent-foreground',
                  )
                }
              >
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Outlet />
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Созвон — запись на звонок без переписки и лишних шагов
      </footer>
      <Toaster position="top-center" richColors />
    </div>
  )
}

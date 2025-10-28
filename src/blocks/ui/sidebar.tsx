import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { PanelLeft } from 'lucide-react'
import clsx from 'clsx'

type SidebarContextValue = {
  state: 'expanded' | 'collapsed'
  isMobile: boolean
  expanded: boolean
  toggle: () => void
  closeMobile: () => void
  setExpanded: (value: boolean) => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_ICON = '3.5rem'

function cn(...inputs: Parameters<typeof clsx>) {
  return clsx(...inputs)
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia(query)
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(media.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

type SidebarProviderProps = {
  defaultCollapsed?: boolean
  children: React.ReactNode
}

export function SidebarProvider({ defaultCollapsed = false, children }: SidebarProviderProps) {
  const isMobile = useMediaQuery('(max-width: 1024px)')
  const [desktopExpanded, setDesktopExpanded] = React.useState(!defaultCollapsed)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => {
    if (!isMobile) {
      setMobileOpen(false)
    }
  }, [isMobile])

  const expanded = isMobile ? mobileOpen : desktopExpanded
  const state: SidebarContextValue['state'] = expanded ? 'expanded' : 'collapsed'

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      state,
      isMobile,
      expanded,
      toggle: () => {
        if (isMobile) {
          setMobileOpen((prev) => !prev)
        } else {
          setDesktopExpanded((prev) => !prev)
        }
      },
      closeMobile: () => setMobileOpen(false),
      setExpanded: (value: boolean) => {
        if (isMobile) {
          setMobileOpen(value)
        } else {
          setDesktopExpanded(value)
        }
      }
    }),
    [expanded, isMobile, state]
  )

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

type SidebarProps = React.ComponentPropsWithoutRef<'aside'>

export const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(function Sidebar(
  { className, children, ...props },
  ref
) {
  const { expanded, isMobile, closeMobile } = useSidebar()

  return (
    <>
      <aside
        ref={ref}
        data-state={expanded ? 'expanded' : 'collapsed'}
        className={cn(
          'group/sidebar fixed inset-y-0 left-0 z-40 flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 ease-in-out',
          isMobile
            ? expanded
              ? 'translate-x-0 shadow-lg'
              : '-translate-x-full'
            : expanded
              ? `w-[var(--sidebar-width,${SIDEBAR_WIDTH})]`
              : `w-[var(--sidebar-icon-width,${SIDEBAR_WIDTH_ICON})]`,
          className
        )}
        {...props}
      >
        {children}
      </aside>
      {isMobile ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={closeMobile}
          className={cn(
            'fixed inset-0 z-30 bg-black/40 transition-opacity duration-200 ease-in-out',
            expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        />
      ) : null}
    </>
  )
})

type SidebarContentProps = React.ComponentPropsWithoutRef<'nav'>

export const SidebarContent = React.forwardRef<HTMLDivElement, SidebarContentProps>(
  function SidebarContent({ className, children, ...props }, ref) {
    return (
      <nav
        ref={ref}
        className={cn('flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4', className)}
        {...props}
      >
        {children}
      </nav>
    )
  }
)

type SidebarHeaderProps = React.ComponentPropsWithoutRef<'header'>

export const SidebarHeader = React.forwardRef<HTMLDivElement, SidebarHeaderProps>(
  function SidebarHeader({ className, children, ...props }, ref) {
    return (
      <header
        ref={ref}
        className={cn('border-b border-sidebar-border px-3 py-4 text-sm font-semibold', className)}
        {...props}
      >
        {children}
      </header>
    )
  }
)

type SidebarFooterProps = React.ComponentPropsWithoutRef<'footer'>

export const SidebarFooter = React.forwardRef<HTMLDivElement, SidebarFooterProps>(
  function SidebarFooter({ className, children, ...props }, ref) {
    return (
      <footer
        ref={ref}
        className={cn(
          'border-t border-sidebar-border px-3 py-3 text-xs text-sidebar-foreground/70',
          className
        )}
        {...props}
      >
        {children}
      </footer>
    )
  }
)

type SidebarGroupProps = React.ComponentPropsWithoutRef<'section'>

export const SidebarGroup = React.forwardRef<HTMLDivElement, SidebarGroupProps>(
  function SidebarGroup({ className, children, ...props }, ref) {
    return (
      <section
        ref={ref}
        className={cn('flex flex-col gap-2 text-sm text-sidebar-foreground', className)}
        {...props}
      >
        {children}
      </section>
    )
  }
)

type SidebarGroupLabelProps = React.ComponentPropsWithoutRef<'div'>

export const SidebarGroupLabel = React.forwardRef<HTMLDivElement, SidebarGroupLabelProps>(
  function SidebarGroupLabel({ className, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'px-2 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

type SidebarGroupContentProps = React.ComponentPropsWithoutRef<'div'>

export const SidebarGroupContent = React.forwardRef<HTMLDivElement, SidebarGroupContentProps>(
  function SidebarGroupContent({ className, children, ...props }, ref) {
    return (
      <div ref={ref} className={cn('flex flex-col gap-1', className)} {...props}>
        {children}
      </div>
    )
  }
)

type SidebarMenuProps = React.ComponentPropsWithoutRef<'ul'>

export const SidebarMenu = React.forwardRef<HTMLUListElement, SidebarMenuProps>(
  function SidebarMenu({ className, children, ...props }, ref) {
    return (
      <ul ref={ref} className={cn('flex flex-col gap-1', className)} {...props}>
        {children}
      </ul>
    )
  }
)

type SidebarMenuItemProps = React.ComponentPropsWithoutRef<'li'>

export const SidebarMenuItem = React.forwardRef<HTMLLIElement, SidebarMenuItemProps>(
  function SidebarMenuItem({ className, children, ...props }, ref) {
    return (
      <li
        ref={ref}
        className={cn('group/sidebar-item relative', className)}
        {...props}
      >
        {children}
      </li>
    )
  }
)

type SidebarMenuButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  asChild?: boolean
  isActive?: boolean
}

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  function SidebarMenuButton({ asChild = false, className, isActive, children, ...props }, ref) {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref as any}
        data-active={isActive ? 'true' : 'false'}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
          'text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
          className
        )}
        {...props}
      >
        {children}
      </Comp>
    )
  }
)

type SidebarSeparatorProps = React.ComponentPropsWithoutRef<'div'>

export const SidebarSeparator = React.forwardRef<HTMLDivElement, SidebarSeparatorProps>(
  function SidebarSeparator({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('my-1 h-px bg-sidebar-border/60', className)}
        {...props}
      />
    )
  }
)

type SidebarTriggerProps = React.ComponentPropsWithoutRef<'button'>

export const SidebarTrigger = React.forwardRef<HTMLButtonElement, SidebarTriggerProps>(
  function SidebarTrigger({ className, children, ...props }, ref) {
    const { toggle, state } = useSidebar()

    return (
      <button
        ref={ref}
        type="button"
        aria-label={state === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
        onClick={toggle}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          className
        )}
        {...props}
      >
        {children ?? <PanelLeft className="h-4 w-4" />}
      </button>
    )
  }
)

type SidebarInsetProps = React.ComponentPropsWithoutRef<'div'>

export const SidebarInset = React.forwardRef<HTMLDivElement, SidebarInsetProps>(
  function SidebarInset({ className, children, ...props }, ref) {
    const { expanded, isMobile } = useSidebar()
  // Always pad content when not on mobile so constrained containers don't drift under the fixed sidebar
  const desktopMargin = expanded
    ? `pl-[var(--sidebar-width,${SIDEBAR_WIDTH})]`
    : `pl-[var(--sidebar-icon-width,${SIDEBAR_WIDTH_ICON})]`
    return (
      <div
        ref={ref}
        className={cn(
          'flex min-h-screen flex-col',
          isMobile ? 'pl-0' : desktopMargin,
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

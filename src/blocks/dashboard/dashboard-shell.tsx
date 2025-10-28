import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { CircleUserRound } from 'lucide-react'
import clsx from 'clsx'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar
} from '@blocks/ui/sidebar'

type DashboardNavItemElement = React.ReactElement<{
  children?: React.ReactNode
  className?: string
  onClick?: React.MouseEventHandler
}>

export type DashboardNavItem = {
  key: string
  label: string
  icon: LucideIcon
  href?: string
  badge?: string
  active?: boolean
  element?: DashboardNavItemElement
}

export type DashboardNavGroup = {
  key: string
  label: string
  items: DashboardNavItem[]
}

export type DashboardUserSummary = {
  name?: string | null
  email?: string | null
}

export type DashboardShellProps = {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  nav: DashboardNavGroup[]
  user?: DashboardUserSummary | null
  children: React.ReactNode
}

export function DashboardShell({ title, subtitle, actions, nav, user, children }: DashboardShellProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar className="flex">
          <SidebarHeader className="flex items-center gap-2 text-base">
            <CircleUserRound className="h-5 w-5 text-sidebar-primary" />
            <span>SEO Agent</span>
          </SidebarHeader>
          <SidebarContent>
            {nav.map((group) => (
              <DashboardSidebarGroup key={group.key} group={group} />
            ))}
          </SidebarContent>
          <SidebarSeparator />
          <SidebarFooter>
            <UserSummary user={user} />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
              <SidebarTrigger className="lg:hidden" />
              <div className="flex flex-1 flex-col">
                {title ? <h1 className="text-2xl font-semibold leading-tight">{title}</h1> : null}
                {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
              </div>
              {actions}
            </div>
          </header>
          <main className="flex flex-1 flex-col px-4 py-6 lg:px-8">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

function DashboardSidebarGroup({ group }: { group: DashboardNavGroup }) {
  const { closeMobile } = useSidebar()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => (
            <SidebarMenuItem key={item.key}>
              <SidebarMenuButton
                asChild={Boolean(item.element)}
                isActive={item.active}
                onClick={() => closeMobile()}
              >
                {item.element ? renderNavElement(item) : renderNavAnchor(item)}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function renderNavAnchor(item: DashboardNavItem) {
  return (
    <a className="flex w-full items-center gap-2 text-left" href={item.href ?? '#'}>
      <NavItemLabel item={item} />
    </a>
  )
}

function renderNavElement(item: DashboardNavItem) {
  return React.cloneElement(
    item.element!,
    {
      className: clsx('flex w-full items-center gap-2 text-left', item.element?.props?.className)
    },
    <NavItemLabel item={item} />
  )
}

function NavItemLabel({ item }: { item: DashboardNavItem }) {
  const Icon = item.icon
  return (
    <>
      <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
      <span className="truncate">{item.label}</span>
      {item.badge ? (
        <span className="ml-auto rounded-full bg-sidebar-accent px-2 py-0.5 text-[11px] font-semibold text-sidebar-accent-foreground">
          {item.badge}
        </span>
      ) : null}
    </>
  )
}

function UserSummary({ user }: { user?: DashboardUserSummary | null }) {
  if (!user) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-sidebar-foreground/70">Not signed in</div>
      </div>
    )
  }
  const initials = getInitials(user.name, user.email)
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
        {initials}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-sidebar-foreground">
          {user.name ?? user.email ?? 'Account'}
        </span>
        {user.email ? (
          <span className="text-xs text-sidebar-foreground/70">{user.email}</span>
        ) : null}
      </div>
    </div>
  )
}

function getInitials(name?: string | null, email?: string | null) {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) {
      return parts[0]!.slice(0, 2).toUpperCase()
    }
    return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
  }
  if (email) {
    return email.slice(0, 2).toUpperCase()
  }
  return '??'
}

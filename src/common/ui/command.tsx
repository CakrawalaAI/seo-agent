import * as React from 'react'
import * as Cmdk from 'cmdk'
import { cn } from '@src/common/ui/cn'

export const Command = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof Cmdk.Command>>(
  function Command({ className, ...props }, ref) {
    return (
      <Cmdk.Command
        ref={ref}
        className={cn(
          'flex h-full w-full flex-col overflow-hidden rounded-md border bg-background text-foreground',
          className
        )}
        {...props}
      />
    )
  }
)

export const CommandInput = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<typeof Cmdk.Command.Input>>(
  function CommandInput({ className, ...props }, ref) {
    return (
      <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
        <Cmdk.Command.Input
          ref={ref}
          className={cn('flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground', className)}
          {...props}
        />
      </div>
    )
  }
)

export const CommandList = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof Cmdk.Command.List>>(
  function CommandList({ className, ...props }, ref) {
    return (
      <Cmdk.Command.List ref={ref} className={cn('max-h-60 overflow-y-auto p-1', className)} {...props} />
    )
  }
)

export const CommandEmpty = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof Cmdk.Command.Empty>>(
  function CommandEmpty({ className, ...props }, ref) {
    return (
      <Cmdk.Command.Empty ref={ref} className={cn('p-3 text-sm text-muted-foreground', className)} {...props} />
    )
  }
)

export const CommandGroup = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof Cmdk.Command.Group>>(
  function CommandGroup({ className, ...props }, ref) {
    return (
      <Cmdk.Command.Group ref={ref} className={cn('px-1 py-1 text-sm', className)} {...props} />
    )
  }
)

export const CommandItem = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof Cmdk.Command.Item>>(
  function CommandItem({ className, ...props }, ref) {
    return (
      <Cmdk.Command.Item
        ref={ref}
        className={cn('flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm aria-selected:bg-muted', className)}
        {...props}
      />
    )
  }
)

export const CommandSeparator = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof Cmdk.Command.Separator>>(
  function CommandSeparator({ className, ...props }, ref) {
    return <Cmdk.Command.Separator ref={ref} className={cn('my-1 h-px bg-border', className)} {...props} />
  }
)


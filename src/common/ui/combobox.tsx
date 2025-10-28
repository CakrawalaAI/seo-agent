import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@src/common/ui/cn'
import { Button } from '@src/common/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@src/common/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@src/common/ui/popover'

export type ComboboxItem = { value: string; label: string }

export function Combobox({
  items,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  className
}: {
  items: ComboboxItem[]
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const label = value ? items.find((i) => i.value === value)?.label : ''
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn('w-[200px] justify-between', className)}>
          {label || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  onSelect={(current) => {
                    onChange?.(current === value ? '' : current)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === item.value ? 'opacity-100' : 'opacity-0')} />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}


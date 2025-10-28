import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'

import { Button } from '@src/common/ui/button'
import { Calendar } from '@src/common/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@src/common/ui/popover'
import { cn } from '@src/common/ui/cn'

export function DatePicker({ value, onChange, placeholder = 'Pick a date', className }: { value?: Date; onChange?: (d?: Date) => void; placeholder?: string; className?: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!value}
          className={cn('w-[280px] justify-start text-left font-normal data-[empty=true]:text-muted-foreground', className)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'PPP') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={value} onSelect={(d) => onChange?.(d)} />
      </PopoverContent>
    </Popover>
  )
}


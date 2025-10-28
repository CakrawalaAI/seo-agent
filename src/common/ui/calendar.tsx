import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

export const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  function Calendar({ className, ...props }, ref) {
    return (
      <div ref={ref} className={className}>
        <DayPicker
          captionLayout="buttons"
          showOutsideDays
          {...props}
        />
      </div>
    )
  }
)


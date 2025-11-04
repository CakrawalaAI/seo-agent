import { cn } from '@src/common/ui/cn'

export function GoogleMark(props: React.SVGProps<SVGSVGElement>) {
  const { className, ...rest } = props
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn('h-4 w-4', className)}
      {...rest}
    >
      <path
        fill="#EA4335"
        d="M12.24 5.3a6.8 6.8 0 0 1 4.8 1.87l3.18-3.18A11.44 11.44 0 0 0 12.24 1C7.5 1 3.36 3.73 1.46 7.78l3.7 2.88c.88-2.63 3.39-5.36 7.08-5.36Z"
      />
      <path
        fill="#34A853"
        d="M23 12.24c0-.88-.08-1.54-.26-2.21H12.24v4.18h6.1c-.12 1.05-.78 2.63-2.24 3.7l3.49 2.7c2.09-1.93 3.41-4.78 3.41-8.37Z"
      />
      <path
        fill="#4285F4"
        d="M7.38 15.08A6.87 6.87 0 0 1 6.99 12c0-1.08.2-2.08.39-3.08l-3.7-2.87A11.11 11.11 0 0 0 2 12c0 1.8.43 3.5 1.16 5.04l3.69-1.96Z"
      />
      <path
        fill="#FBBC05"
        d="M12.24 23c3.04 0 5.6-1 7.47-2.71l-3.49-2.7c-.94.65-2.21 1.09-3.98 1.09-3.05 0-5.62-2-6.56-4.68l-3.69 1.96C3.94 20.49 7.77 23 12.24 23Z"
      />
    </svg>
  )
}

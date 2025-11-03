import * as React from 'react'
import type { FieldApi, FormApi } from '@tanstack/react-form'
import { cn } from './cn'
import { Label } from './label'

type AnyForm = FormApi<any, any>
type AnyField = FieldApi<any, any, any, any, any>
type AnyFieldOptions = Parameters<AnyForm['useField']>[0]

type FormContextValue = {
  form: AnyForm
}

const FormContext = React.createContext<FormContextValue | null>(null)

function useFormContext(): FormContextValue {
  const context = React.useContext(FormContext)
  if (!context) {
    throw new Error('Form components must be used within a <Form form={...}> provider')
  }
  return context
}

type FieldContextValue = {
  field: AnyField
}

const FieldContext = React.createContext<FieldContextValue | null>(null)

function useFieldContext(): FieldContextValue {
  const context = React.useContext(FieldContext)
  if (!context) {
    throw new Error('Form field components must be used within <FormField name="...">')
  }
  return context
}

export function Form<TFormData>({ form, children }: { form: FormApi<TFormData, any>; children: React.ReactNode }) {
  return <FormContext.Provider value={{ form }}>{children}</FormContext.Provider>
}

export function FormField({
  name,
  children,
  options
}: {
  name: AnyFieldOptions['name']
  options?: Omit<AnyFieldOptions, 'name'>
  children: (field: AnyField) => React.ReactNode
}) {
  const { form } = useFormContext()
  const field = form.useField({ ...(options as object | undefined), name } as AnyFieldOptions)
  return <FieldContext.Provider value={{ field }}>{children(field)}</FieldContext.Provider>
}

export function FormItem({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('space-y-2', className)}>{children}</div>
}

export function FormLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  const { field } = useFieldContext()
  return (
    <Label className={className} htmlFor={String(field.name)}>
      {children}
    </Label>
  )
}

export function FormControl({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('space-y-1', className)}>{children}</div>
}

export function FormDescription({ className, children }: { className?: string; children?: React.ReactNode }) {
  if (!children) return null
  return <p className={cn('text-xs text-muted-foreground', className)}>{children}</p>
}

function formatError(error: unknown): string | null {
  if (error == null) return null
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in (error as any) && typeof (error as any).message === 'string') {
    return (error as any).message
  }
  try {
    return String(error)
  } catch {
    return null
  }
}

export function FormMessage({ className, message }: { className?: string; message?: string | null }) {
  const { field } = useFieldContext()
  const meta = field.state.meta
  const fieldError =
    meta.touchedErrors?.[0] ??
    meta.errors?.[0] ??
    field.form.store.state.errors?.[0]

  const error = message || fieldError
  const text = formatError(error)
  if (!text) return null
  return <p className={cn('text-xs text-destructive', className)}>{text}</p>
}

export type { FieldApi, FormApi } from '@tanstack/react-form'

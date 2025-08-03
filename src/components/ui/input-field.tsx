import * as React from "react"
import { Input } from "./input"
import { Label } from "./label"
import { cn } from "@/lib/utils"

// React 19: ComponentPropsWithRefを使用したカスタムInputFieldコンポーネント
// forwardRefを使用せずに、refを通常のpropsとして受け取る
interface InputFieldProps extends React.ComponentPropsWithRef<"input"> {
  label?: React.ReactNode
  error?: string
  helperText?: string
  containerClassName?: string
}

function InputField({
  label,
  error,
  helperText,
  containerClassName,
  className,
  id,
  ...props
}: InputFieldProps) {
  // React 19: useIdを常に呼び出し、idが指定されている場合はそれを優先
  const generatedId = React.useId()
  const inputId = id || generatedId

  return (
    <div className={cn("space-y-2", containerClassName)}>
      {label && (
        <Label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </Label>
      )}
      <Input
        id={inputId}
        className={cn(
          error && "border-destructive focus-visible:ring-destructive/20",
          className
        )}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={
          error ? `${inputId}-error` :
          helperText ? `${inputId}-helper` : undefined
        }
        {...props}
      />
      {error && (
        <p
          id={`${inputId}-error`}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p
          id={`${inputId}-helper`}
          className="text-sm text-muted-foreground"
        >
          {helperText}
        </p>
      )}
    </div>
  )
}

export { InputField, type InputFieldProps }

import { type ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const variantStyles: Record<string, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  secondary:
    'bg-[var(--cos-bg-tertiary)] hover:bg-[var(--cos-bg-hover)] text-[var(--cos-text-primary)] border border-[var(--cos-border)]',
  ghost: 'hover:bg-[var(--cos-bg-hover)] text-[var(--cos-text-secondary)]',
  danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30'
}

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-sm'
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      className={`rounded-md font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

import React from 'react';
import { RefreshCw } from 'lucide-react';

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isPending?: boolean;
  label: React.ReactNode;
  loadingLabel?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'primary' | 'danger' | 'secondary';
}

const variantClasses: Record<NonNullable<SubmitButtonProps['variant']>, string> = {
  primary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white',
  secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
};

const SubmitButton: React.FC<SubmitButtonProps> = ({
  isPending = false,
  label,
  loadingLabel,
  icon,
  variant = 'primary',
  className = '',
  disabled,
  type = 'submit',
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || isPending}
    className={`px-4 py-2 rounded-xl font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition ${variantClasses[variant]} ${className}`}
    {...rest}
  >
    {isPending ? <RefreshCw size={16} className="animate-spin" /> : icon}
    {isPending && loadingLabel ? loadingLabel : label}
  </button>
);

export default SubmitButton;

import { cn } from '@/lib/utils';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg shadow-sm', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
      <div>
        <h2 className="text-sm font-semibold text-navy-700 uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className="status-pill" data-status={status}>{status}</span>;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'inline-flex items-center justify-center font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizeCls = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm';
  const variantCls = {
    primary: 'bg-navy-700 text-white hover:bg-navy-900',
    secondary: 'bg-white text-navy-700 border border-gray-300 hover:bg-gray-50',
    ghost: 'text-gray-600 hover:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }[variant];
  return (
    <button className={cn(base, sizeCls, variantCls, className)} {...props}>
      {children}
    </button>
  );
}

export function Tag({ children, color = 'gray' }: { children: React.ReactNode; color?: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' }) {
  const colorCls = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-helm-blue text-navy-700',
    green: 'bg-helm-green text-green-800',
    yellow: 'bg-helm-yellow text-yellow-900',
    red: 'bg-helm-red text-red-900',
    purple: 'bg-helm-purple text-purple-900',
  }[color];
  return <span className={cn('tag', colorCls)}>{children}</span>;
}

export function Empty({ message }: { message: string }) {
  return <div className="text-center py-12 text-sm text-gray-500">{message}</div>;
}

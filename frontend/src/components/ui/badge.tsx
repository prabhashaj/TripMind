import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'purple' | 'emerald' | 'outline' | 'secondary';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        {
          'bg-slate-800 text-slate-200 border border-white/10': variant === 'default',
          'bg-purple-400/10 text-purple-300 border border-purple-400/25': variant === 'purple',
          'bg-emerald-400/10 text-emerald-300 border border-emerald-400/25': variant === 'emerald',
          'text-slate-400 border border-white/15': variant === 'outline',
          'bg-slate-900 text-slate-400': variant === 'secondary',
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };

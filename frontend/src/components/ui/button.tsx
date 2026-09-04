import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'brass' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]',
          {
            'bg-amber-700 text-white hover:bg-amber-800 shadow-md shadow-amber-700/20 font-semibold':
              variant === 'brass',
            'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-white/10':
              variant === 'default',
            'border border-white/15 bg-transparent hover:bg-white/5 text-slate-200':
              variant === 'outline',
            'hover:bg-white/5 text-slate-400 hover:text-slate-100':
              variant === 'ghost',
            'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-white/5':
              variant === 'secondary',
          },
          {
            'h-10 px-5 py-2 text-sm': size === 'default',
            'h-8 rounded-lg px-3 text-xs': size === 'sm',
            'h-12 rounded-xl px-8 text-base': size === 'lg',
            'h-9 w-9 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };

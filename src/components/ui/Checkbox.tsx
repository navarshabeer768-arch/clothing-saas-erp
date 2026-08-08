import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const generatedId = useId();
    const checkboxId = id ?? generatedId;

    return (
      <label htmlFor={checkboxId} className="inline-flex items-center gap-2 text-sm text-brand-800">
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          className={cn(
            'h-4 w-4 rounded border-brand-300 text-brand-800',
            'focus:outline-none focus:ring-2 focus:ring-brand-400',
            className
          )}
          {...props}
        />
        {label}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

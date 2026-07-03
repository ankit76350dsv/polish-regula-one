// Form field primitives: label + control + error in one accessible block.
// Native <select>/<textarea> styled to match the Input component.
import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const controlClass =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm ' +
  'text-foreground shadow-xs transition-colors outline-none ' +
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ' +
  'disabled:pointer-events-none disabled:opacity-50';

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(controlClass, 'appearance-none bg-card', className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(controlClass, 'h-auto min-h-20 resize-y bg-card', className)}
      {...props}
    />
  );
}

/**
 * <FormField label="…" error="…" hint="…">{(id) => <Input id={id} …/>}</FormField>
 * Children can be a render function receiving the generated id, or a plain node.
 */
export function FormField({ label, required, error, hint, children }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label} {required && <span className="text-destructive" aria-hidden>*</span>}
      </Label>
      {typeof children === 'function' ? children(id) : children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] text-destructive" role="alert">{error}</p>}
    </div>
  );
}

export { Input, Label };

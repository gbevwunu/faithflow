import type { ReactNode } from "react";

export const inputClass = (invalid: boolean) =>
  `h-12 w-full rounded-input border bg-surface px-4 text-[17px] text-ink placeholder:text-muted focus:outline-2 focus:outline-primary/20 ${
    invalid ? "border-danger focus:border-danger" : "border-border focus:border-primary"
  }`;

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-[13px] text-danger">
      {message}
    </p>
  );
}

export function FormField({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[15px] font-medium text-ink">
        {label}
        {required && (
          <>
            <span aria-hidden="true"> *</span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

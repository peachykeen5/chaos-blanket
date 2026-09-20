import clsx from "clsx";
import type { ReactNode } from "react";

interface InlineErrorProps {
  children: ReactNode;
  className?: string;
}

export function InlineError({ children, className }: InlineErrorProps) {
  return (
    <p role="alert" className={clsx("text-sm text-red-600", className)}>
      {children}
    </p>
  );
}

import clsx from "clsx";
import type { ReactNode } from "react";

interface ConfirmationProps {
  visible: boolean;
  children: ReactNode;
  className?: string;
}

export function Confirmation({ visible, children, className }: ConfirmationProps) {
  if (!visible) return null;
  return <span className={clsx("ml-1 text-xs text-green-600", className)}>{children}</span>;
}

import type { ReactNode } from "react";

interface HeadingProps {
  level: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}

const LEVEL_CLASSES: Record<1 | 2 | 3, string> = {
  1: "text-2xl font-bold text-gray-900",
  2: "text-lg font-semibold text-gray-900",
  3: "font-semibold text-gray-900",
};

export function Heading({ level, children, className }: HeadingProps) {
  const combinedClassName = className ? `${LEVEL_CLASSES[level]} ${className}` : LEVEL_CLASSES[level];

  if (level === 1) return <h1 className={combinedClassName}>{children}</h1>;
  if (level === 2) return <h2 className={combinedClassName}>{children}</h2>;
  return <h3 className={combinedClassName}>{children}</h3>;
}

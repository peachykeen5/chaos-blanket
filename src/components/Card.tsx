import clsx from "clsx";
import type { ReactNode } from "react";
import { Heading } from "./Heading";

interface CardProps {
  title?: string;
  titleLevel?: 2 | 3;
  children: ReactNode;
  className?: string;
}

export function Card({ title, titleLevel = 2, children, className }: CardProps) {
  return (
    <section className={clsx("mt-6 border-t border-gray-200 pt-4", className)}>
      {title && <Heading level={titleLevel}>{title}</Heading>}
      {children}
    </section>
  );
}

import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "accent" | "danger" | "link" | "link-danger";
type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const FILLED_VARIANT_CLASSES: Record<"primary" | "accent" | "danger", string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  accent: "bg-accent text-white hover:bg-accent-hover",
  danger: "bg-danger text-white hover:bg-danger-hover",
};

const LINK_VARIANT_CLASSES: Record<"link" | "link-danger", string> = {
  link: "text-primary underline",
  "link-danger": "text-danger underline",
};

const LINK_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "text-xs",
  md: "text-sm",
};

export function Button({
  variant = "primary",
  size = "sm",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  const isFilled = variant === "primary" || variant === "accent" || variant === "danger";

  return (
    <button
      type={type}
      className={clsx(
        isFilled
          ? clsx(
              "rounded px-3 py-1 text-sm disabled:cursor-not-allowed disabled:bg-gray-300",
              FILLED_VARIANT_CLASSES[variant]
            )
          : clsx(LINK_VARIANT_CLASSES[variant], LINK_SIZE_CLASSES[size]),
        className
      )}
      {...props}
    />
  );
}

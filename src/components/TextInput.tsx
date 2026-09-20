import clsx from "clsx";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldSize = "sm" | "xs";

const TEXT_SIZE_CLASSES: Record<FieldSize, string> = {
  sm: "text-sm",
  xs: "text-xs",
};

export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: FieldSize;
}

export function TextInput({ size = "sm", className, ...props }: TextInputProps) {
  return (
    <input
      className={clsx(
        "rounded border border-gray-300 px-2 py-1",
        TEXT_SIZE_CLASSES[size],
        className
      )}
      {...props}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: FieldSize;
}

export function Textarea({ size = "sm", className, ...props }: TextareaProps) {
  return (
    <textarea
      className={clsx("rounded border border-gray-300 p-2", TEXT_SIZE_CLASSES[size], className)}
      {...props}
    />
  );
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: FieldSize;
}

export function Select({ size = "sm", className, children, ...props }: SelectProps) {
  return (
    <select
      className={clsx(
        "rounded border border-gray-300 px-2 py-1",
        TEXT_SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

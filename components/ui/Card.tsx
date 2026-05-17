import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
  radius?: "default" | "lg";
  /** Более заметная обводка для вложенных элементов */
  bordered?: boolean;
}

export function Card({
  children,
  className,
  padding = "md",
  radius = "default",
  bordered = false,
  ...props
}: CardProps) {
  const paddings = { sm: "p-3", md: "p-4", lg: "p-5" };
  const radii = { default: "rounded-[12px]", lg: "rounded-[16px]" };
  const borderCls = bordered
    ? "border-slate-200 dark:border-slate-600"
    : "border-slate-200 dark:border-slate-700";

  return (
    <div
      className={`
        bg-white dark:bg-slate-900 ${radii[radius]} ${paddings[padding]}
        border ${borderCls}
        shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.32)]
        ${className ?? ""}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

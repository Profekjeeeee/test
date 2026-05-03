import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
  radius?: "default" | "lg";
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

  return (
    <div
      className={`
        bg-white dark:bg-slate-900 ${radii[radius]} ${paddings[padding]}
        ${bordered ? "border border-gray-100 dark:border-slate-700" : "shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-none"}
        ${className ?? ""}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

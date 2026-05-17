import type { SVGAttributes } from "react";

/** Та же форма зуба, что во вкладке «Формула» нижней панели (BottomBar). */
export interface FormulaToothIconProps extends SVGAttributes<SVGSVGElement> {
  /**
   * `outline` — только контур (неактивный таб).
   * `filled-subtle` — лёгкая заливка currentColor (~12%), как активный таб.
   * `solid` — сплошная заливка (например белый символ на `bg-primary`).
   */
  variant?: "outline" | "filled-subtle" | "solid";
}

const TOOTH_PATH =
  "M6.5 3C4.5 3 3 4.5 3 7C3 9.5 4.5 11 5.5 12C5.5 12 5 15 5 18C5 20.5 6 21.5 7.5 21.5C9 21.5 10 20.5 10.5 18.5C11 16.5 11.5 13 12 13C12.5 13 13 16.5 13.5 18.5C14 20.5 15 21.5 16.5 21.5C18 21.5 19 20.5 19 18C19 15 18.5 12 18.5 12C19.5 11 21 9.5 21 7C21 4.5 19.5 3 17.5 3C15.5 3 14 4.5 12 4.5C10 4.5 8.5 3 6.5 3Z";

export function FormulaToothIcon({
  variant = "outline",
  className,
  ...props
}: FormulaToothIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
      {...props}
    >
      {variant === "solid" ? (
        <path d={TOOTH_PATH} fill="currentColor" />
      ) : (
        <path
          d={TOOTH_PATH}
          fill={variant === "filled-subtle" ? "currentColor" : "none"}
          fillOpacity={variant === "filled-subtle" ? 0.12 : undefined}
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

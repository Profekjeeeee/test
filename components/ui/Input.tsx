import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-[13px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full h-12 px-4 rounded-[4px] border text-[15px] font-medium
            bg-white dark:bg-slate-800 text-[#0F172A] dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500
            transition-colors outline-none shadow-raised-surface
            ${
              error
                ? "border-error focus:border-error focus:ring-1 focus:ring-error/30"
                : "border-slate-200 dark:border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/20 dark:focus:border-slate-500 dark:focus:ring-white/15"
            }
            ${className ?? ""}
          `}
          {...props}
        />
        {error && (
          <p className="text-[12px] text-error font-medium">{error}</p>
        )}
        {hint && !error && (
          <p className="text-[12px] text-gray-400">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };

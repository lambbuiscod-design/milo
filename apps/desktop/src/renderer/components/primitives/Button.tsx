import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon,
      iconPosition = "left",
      loading = false,
      fullWidth = false,
      disabled,
      className = "",
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const classes = [
      "milo-btn",
      `milo-btn--${variant}`,
      `milo-btn--${size}`,
      fullWidth ? "milo-btn--full" : "",
      loading ? "milo-btn--loading" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading ? true : undefined}
        {...props}
      >
        {loading && <span className="milo-btn__spinner" aria-hidden="true" />}
        {!loading && icon && iconPosition === "left" && (
          <span className="milo-btn__icon milo-btn__icon--left">{icon}</span>
        )}
        {children && <span className="milo-btn__label">{children}</span>}
        {!loading && icon && iconPosition === "right" && (
          <span className="milo-btn__icon milo-btn__icon--right">{icon}</span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

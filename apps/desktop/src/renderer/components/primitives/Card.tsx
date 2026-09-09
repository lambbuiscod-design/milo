import { forwardRef, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";

export type CardVariant = "flat" | "outlined" | "elevated" | "interactive";
export type CardPadding = "none" | "sm" | "md" | "lg";
export type CardAccent = "none" | "coral" | "safe" | "confident" | "playful";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  accent?: CardAccent;
  selected?: boolean;
  children?: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = "outlined",
      padding = "md",
      accent = "none",
      selected = false,
      className = "",
      children,
      role,
      tabIndex,
      onKeyDown,
      onClick,
      ...props
    },
    ref,
  ) => {
    const isInteractive = variant === "interactive";
    const classes = [
      "milo-card",
      `milo-card--${variant}`,
      `milo-card--pad-${padding}`,
      accent !== "none" ? `milo-card--accent-${accent}` : "",
      selected ? "milo-card--selected" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (isInteractive && onClick && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        onClick(event as unknown as React.MouseEvent<HTMLDivElement>);
      }
      onKeyDown?.(event);
    };

    return (
      <div
        ref={ref}
        className={classes}
        role={role ?? (isInteractive ? "button" : undefined)}
        tabIndex={tabIndex ?? (isInteractive ? 0 : undefined)}
        aria-selected={selected ? true : undefined}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";

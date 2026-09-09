import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

/* -------------------------------------------------------------------------- */
/* Container                                                                  */
/* -------------------------------------------------------------------------- */

export type ContainerSize = "sm" | "md" | "lg" | "full";
export type ContainerPadding = "none" | "sm" | "md" | "lg";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
  padding?: ContainerPadding;
  children?: ReactNode;
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  (
    { size = "md", padding = "md", className = "", children, ...props },
    ref,
  ) => {
    const classes = [
      "milo-container",
      `milo-container--${size}`,
      `milo-container--pad-${padding}`,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  },
);

Container.displayName = "Container";

/* -------------------------------------------------------------------------- */
/* Stack                                                                      */
/* -------------------------------------------------------------------------- */

export type StackDirection = "row" | "column";
export type StackGap = "none" | "xs" | "sm" | "md" | "lg" | "xl";
export type StackAlign = "start" | "center" | "end" | "stretch";
export type StackJustify = "start" | "center" | "end" | "between";

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: StackDirection;
  gap?: StackGap;
  align?: StackAlign;
  justify?: StackJustify;
  wrap?: boolean;
  children?: ReactNode;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(
  (
    {
      direction = "column",
      gap = "md",
      align = "stretch",
      justify = "start",
      wrap = false,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const classes = [
      "milo-stack",
      `milo-stack--${direction}`,
      `milo-stack--gap-${gap}`,
      `milo-stack--align-${align}`,
      `milo-stack--justify-${justify}`,
      wrap ? "milo-stack--wrap" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    );
  },
);

Stack.displayName = "Stack";

/* -------------------------------------------------------------------------- */
/* SectionGroup (Non-nested card layout alternative)                          */
/* -------------------------------------------------------------------------- */

export interface SectionGroupProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  subtitle?: string;
  kicker?: string;
  action?: ReactNode;
  divider?: boolean;
  children?: ReactNode;
}

export const SectionGroup = forwardRef<HTMLElement, SectionGroupProps>(
  (
    {
      title,
      subtitle,
      kicker,
      action,
      divider = true,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const classes = [
      "milo-section-group",
      divider ? "milo-section-group--divider" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <section ref={ref} className={classes} {...props}>
        {(title || kicker || action) && (
          <header className="milo-section-group__header">
            <div>
              {kicker && <p className="milo-section-group__kicker">{kicker}</p>}
              {title && <h3 className="milo-section-group__title">{title}</h3>}
              {subtitle && <p className="milo-section-group__subtitle">{subtitle}</p>}
            </div>
            {action && <div className="milo-section-group__action">{action}</div>}
          </header>
        )}
        <div className="milo-section-group__content">{children}</div>
      </section>
    );
  },
);

SectionGroup.displayName = "SectionGroup";

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

type LabeledControlProps = Readonly<{
  label: string;
  description?: string;
}>;

export type ToggleProps = LabeledControlProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children">;

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, description, className = "", ...props }, ref) => (
    <label className={`milo-toggle ${className}`}>
      <span className="milo-toggle__copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input ref={ref} type="checkbox" {...props} />
      <span className="milo-toggle__track" aria-hidden="true"><span /></span>
    </label>
  ),
);
Toggle.displayName = "Toggle";

export type CheckboxProps = LabeledControlProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children">;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className = "", ...props }, ref) => (
    <label className={`milo-checkbox ${className}`}>
      <input ref={ref} type="checkbox" {...props} />
      <span className="milo-checkbox__mark" aria-hidden="true" />
      <span className="milo-checkbox__copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
    </label>
  ),
);
Checkbox.displayName = "Checkbox";

export type SelectOption = Readonly<{ value: string; label: string; disabled?: boolean }>;
export type SelectProps = LabeledControlProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> &
  Readonly<{ options: readonly SelectOption[] }>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, description, options, className = "", id, ...props }, ref) => {
    const controlId = id ?? `milo-select-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    return (
      <label className={`milo-select ${className}`} htmlFor={controlId}>
        <span className="milo-select__copy"><strong>{label}</strong>{description && <small>{description}</small>}</span>
        <span className="milo-select__control">
          <select ref={ref} id={controlId} {...props}>
            {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
          </select>
          <span aria-hidden="true" />
        </span>
      </label>
    );
  },
);
Select.displayName = "Select";

export type SliderProps = LabeledControlProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> &
  Readonly<{ valueLabel: string }>;

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ label, description, valueLabel, className = "", ...props }, ref) => (
    <label className={`milo-slider ${className}`}>
      <span className="milo-slider__header"><strong>{label}</strong><span>{valueLabel}</span></span>
      {description && <small>{description}</small>}
      <input ref={ref} type="range" {...props} />
    </label>
  ),
);
Slider.displayName = "Slider";

export type SegmentedOption<T extends string> = Readonly<{ value: T; label: string }>;
export type SegmentedControlProps<T extends string> = Readonly<{
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}>;

export function SegmentedControl<T extends string>({ label, value, options, onChange, disabled }: SegmentedControlProps<T>) {
  return (
    <fieldset className="milo-segmented" disabled={disabled}>
      <legend>{label}</legend>
      <div className="milo-segmented__items">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            className={value === option.value ? "is-selected" : ""}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Readonly<{ label: string }>;
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, className = "", type = "button", children, ...props }, ref) => (
    <button ref={ref} type={type} className={`milo-icon-button ${className}`} aria-label={label} title={props.title ?? label} {...props}>
      {children}
    </button>
  ),
);
IconButton.displayName = "IconButton";

export function Badge({ tone = "neutral", children }: Readonly<{ tone?: "neutral" | "safe" | "warning" | "danger" | "accent"; children: ReactNode }>) {
  return <span className={`milo-badge milo-badge--${tone}`}>{children}</span>;
}

export function ProgressBar({ value, max = 100, label }: Readonly<{ value: number; max?: number; label: string }>) {
  const boundedMax = Math.max(1, max);
  const boundedValue = Math.max(0, Math.min(boundedMax, value));
  return (
    <div className="milo-progress">
      <div className="milo-progress__label"><span>{label}</span><span>{boundedValue}/{boundedMax}</span></div>
      <progress value={boundedValue} max={boundedMax} aria-label={label} />
    </div>
  );
}

export function SectionHeader({ title, description, action }: Readonly<{ title: string; description?: string; action?: ReactNode }>) {
  return <header className="milo-section-header"><div><h3>{title}</h3>{description && <p>{description}</p>}</div>{action}</header>;
}

export function SettingRow({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`milo-setting-row ${className}`} {...props}>{children}</div>;
}

export function Toast({ tone = "neutral", children }: Readonly<{ tone?: "neutral" | "success" | "danger"; children: ReactNode }>) {
  return <div className={`milo-toast milo-toast--${tone}`} role="status" aria-live="polite">{children}</div>;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Modal({ open, title, children, onClose }: Readonly<{ open: boolean; title: string; children: ReactNode; onClose: () => void }>) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? dialog)?.focus();
    return () => previouslyFocused?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <div className="milo-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        ref={dialogRef}
        className="milo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }
          if (event.key !== "Tab") return;
          const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
          if (focusable.length === 0) {
            event.preventDefault();
            dialogRef.current?.focus();
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <header><h2 id={titleId}>{title}</h2><IconButton label="Close dialog" onClick={onClose}><span className="milo-modal__close-mark" aria-hidden="true" /></IconButton></header>
        {children}
      </section>
    </div>
  );
}

export function Tooltip({ content, children }: Readonly<{ content: string; children: ReactNode }>) {
  const tooltipId = useId();
  return (
    <span className="milo-tooltip">
      <span className="milo-tooltip__trigger" aria-describedby={tooltipId}>{children}</span>
      <span id={tooltipId} className="milo-tooltip__content" role="tooltip">{content}</span>
    </span>
  );
}

export function Popover({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return <div className="milo-popover" role="group" aria-label={label}>{children}</div>;
}

export function Tabs<T extends string>({ label, value, options, onChange }: SegmentedControlProps<T>) {
  return <SegmentedControl label={label} value={value} options={options} onChange={onChange} />;
}

export function SidebarItem({ active = false, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & Readonly<{ active?: boolean }>) {
  return <button type="button" className={`milo-sidebar-item ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined} {...props}>{children}</button>;
}

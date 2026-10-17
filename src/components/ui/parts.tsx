import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, X } from 'lucide-react';

// Shared building blocks for the in-app screens. Same look as the landing page:
// zinc neutrals, one sky accent, hairline borders, 20px radius, no gradients.
// Screens that use them add the `ui-zinc` class to their root so the dark-mode
// overrides in index.css apply.

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
    <section className={`rounded-[20px] border border-zinc-900/[0.08] bg-white ${className}`}>{children}</section>
);

interface CardHeaderProps {
    title: string;
    meta?: React.ReactNode;
    action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, meta, action }) => (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-zinc-950">{title}</h2>
            {meta !== undefined && <span className="shrink-0 text-[13px] tabular-nums text-zinc-400">{meta}</span>}
        </div>
        {action}
    </div>
);

export const LinkButton: React.FC<{ onClick?: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-[13px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
    >
        {children}
        <ArrowUpRight size={14} />
    </button>
);

export const Progress: React.FC<{ value: number; className?: string }> = ({ value, className = 'bg-sky-600' }) => (
    <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full transition-[width] duration-500 ${className}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
);

interface SegmentedProps<T extends string> {
    value: T;
    options: { id: T; label: string }[];
    onChange: (id: T) => void;
    label: string;
    size?: 'sm' | 'md';
    className?: string;
}

export function Segmented<T extends string>({ value, options, onChange, label, size = 'sm', className = '' }: SegmentedProps<T>) {
    const pad = size === 'md' ? 'px-2 py-1.5 text-[13px] sm:px-3.5' : 'px-2.5 py-1 text-[12px]';
    return (
        <div role="tablist" aria-label={label} className={`inline-flex shrink-0 rounded-full bg-zinc-100 p-0.5 ${className}`}>
            {options.map(o => (
                <button
                    key={o.id}
                    type="button"
                    role="tab"
                    aria-selected={value === o.id}
                    onClick={() => onChange(o.id)}
                    className={`flex-1 whitespace-nowrap rounded-full font-medium transition-colors ${pad} ${value === o.id ? 'bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

interface MetricProps {
    label: string;
    icon: React.ReactNode;
    value: React.ReactNode;
    sub?: React.ReactNode;
    onClick?: () => void;
    // Extra control in the top-right corner (e.g. hide balance). Clicks on it do not trigger onClick.
    action?: React.ReactNode;
}

// A metric tile. The whole tile is one button; `action` sits above it so it can be pressed on its own.
export const Metric: React.FC<MetricProps> = ({ label, icon, value, sub, onClick, action }) => (
    <div className="relative rounded-[20px] border border-zinc-900/[0.08] bg-white p-4 transition-colors hover:border-zinc-900/[0.18]">
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="absolute inset-0 rounded-[20px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        />
        <div className="pointer-events-none relative flex items-center justify-between gap-2 text-[13px] text-zinc-500">
            <span className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-zinc-400">{icon}</span>
                <span className="truncate">{label}</span>
            </span>
            {action && <span className="pointer-events-auto -m-1">{action}</span>}
        </div>
        <div className="pointer-events-none relative mt-3 truncate text-[20px] font-semibold tracking-tight tabular-nums text-zinc-950 sm:text-[22px]">
            {value}
        </div>
        {sub && <div className="pointer-events-none relative mt-1 truncate text-[12px] text-zinc-500">{sub}</div>}
    </div>
);

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
    primary: 'bg-zinc-950 text-white hover:bg-zinc-800',
    secondary: 'border border-zinc-900/[0.1] bg-white text-zinc-800 hover:bg-zinc-50',
    ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
    danger: 'text-red-700 hover:bg-red-50',
};

// Pill button. 40px tall so it is easy to hit on a phone.
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }> = ({
    variant = 'secondary',
    className = '',
    type = 'button',
    ...rest
}) => (
    <button
        type={type}
        className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
        {...rest}
    />
);

// Square icon-only button. Always pass `label`: it becomes the aria-label and tooltip.
export const IconButton: React.FC<Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & { label: string }> = ({
    label,
    className = '',
    type = 'button',
    ...rest
}) => (
    <button
        type={type}
        aria-label={label}
        title={label}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 ${className}`}
        {...rest}
    />
);

// Small uppercase-free section label used above lists.
export const SectionLabel: React.FC<{ children: React.ReactNode; meta?: React.ReactNode }> = ({ children, meta }) => (
    <h3 className="mb-2 flex items-baseline gap-2 px-1 text-[13px] font-medium text-zinc-500">
        {children}
        {meta !== undefined && <span className="tabular-nums text-zinc-400">{meta}</span>}
    </h3>
);

export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }> = ({ icon, title, hint, action }) => (
    <div className="flex flex-col items-center rounded-[20px] border border-dashed border-zinc-200 px-6 py-12 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">{icon}</div>
        <p className="text-[15px] font-medium text-zinc-900">{title}</p>
        {hint && <p className="mt-1 max-w-xs text-[13px] text-zinc-500">{hint}</p>}
        {action && <div className="mt-4">{action}</div>}
    </div>
);

interface SheetProps {
    open: boolean;
    onClose: () => void;
    title: React.ReactNode;
    // Content shown under the title (e.g. a subtitle).
    subtitle?: React.ReactNode;
    // Pinned to the bottom of the sheet, outside the scroll area.
    footer?: React.ReactNode;
    children: React.ReactNode;
    maxWidth?: string;
}

// Dialog that is a bottom sheet on phones and a centered card from `sm` up.
// Rendered in a portal, so it carries `ui-zinc` itself for dark mode.
export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, subtitle, footer, children, maxWidth = 'sm:max-w-md' }) => {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div className="ui-zinc fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4">
            <div className="ui-fade-in absolute inset-0 bg-zinc-950/40" onClick={onClose} />
            <div
                role="dialog"
                aria-modal="true"
                className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white text-zinc-900 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.25)] ui-sheet-in sm:rounded-[24px] ${maxWidth}`}
            >
                <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-zinc-200 sm:hidden" aria-hidden />
                <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
                    <div className="min-w-0">
                        <h2 className="text-[17px] font-semibold tracking-tight text-zinc-950">{title}</h2>
                        {subtitle && <div className="mt-0.5 text-[13px] text-zinc-500">{subtitle}</div>}
                    </div>
                    <IconButton label="Đóng" onClick={onClose} className="-mr-2 -mt-1">
                        <X size={18} />
                    </IconButton>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
                {footer && <div className="shrink-0 border-t border-zinc-900/[0.06] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
            </div>
        </div>,
        document.body
    );
};

// Text field styles shared by forms.
export const inputClass =
    'w-full rounded-xl border border-zinc-900/[0.1] bg-white px-3.5 py-2.5 text-[14px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-600/15';

export const FieldLabel: React.FC<{ htmlFor?: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-zinc-600">
        {children}
    </label>
);

'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ── Shared control chrome ───────────────────────────────────────────────── */

const CONTROL =
    'w-full rounded-input border border-input bg-card text-foreground shadow-xs ' +
    'transition-[border-color,box-shadow] duration-150 ' +
    'placeholder:text-muted-foreground ' +
    'focus:border-ring focus:outline-none focus:ring-4 focus:ring-ring/15 ' +
    'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground';

const INVALID =
    'border-destructive focus:border-destructive focus:ring-destructive/15';

/* ── Label / Field wrapper ───────────────────────────────────────────────── */

export function Label({
    className,
    required,
    children,
    ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
    return (
        <label
            className={cn(
                'block text-[13px] font-semibold text-foreground',
                className,
            )}
            {...props}
        >
            {children}
            {required && (
                <span className="ml-0.5 text-destructive" aria-hidden>
                    *
                </span>
            )}
        </label>
    );
}

export interface FieldProps {
    label?: React.ReactNode;
    /** Rendered under the control in muted text. */
    hint?: React.ReactNode;
    /** Rendered under the control in destructive text; also flags the control. */
    error?: React.ReactNode;
    required?: boolean;
    htmlFor?: string;
    className?: string;
    children: React.ReactNode;
}

/**
 * Layout wrapper: label above, control, then hint or error.
 * Keeps every form in the product vertically consistent.
 */
export function Field({
    label,
    hint,
    error,
    required,
    htmlFor,
    className,
    children,
}: FieldProps) {
    return (
        <div className={cn('space-y-1.5', className)}>
            {label && (
                <Label htmlFor={htmlFor} required={required}>
                    {label}
                </Label>
            )}
            {children}
            {error ? (
                <p className="text-xs font-medium text-destructive">{error}</p>
            ) : hint ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    );
}

/* ── Input ───────────────────────────────────────────────────────────────── */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    invalid?: boolean;
    /** Icon rendered inside the control, on the leading edge. */
    leadingIcon?: React.ReactNode;
    /** Node rendered inside the control, on the trailing edge (icon or button). */
    trailingSlot?: React.ReactNode;
    inputSize?: 'sm' | 'md';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    function Input(
        {
            className,
            invalid,
            leadingIcon,
            trailingSlot,
            inputSize = 'md',
            ...props
        },
        ref,
    ) {
        const sizing =
            inputSize === 'sm' ? 'h-9 px-3 text-[13px]' : 'h-10 px-3.5 text-sm';

        const control = (
            <input
                ref={ref}
                aria-invalid={invalid || undefined}
                className={cn(
                    CONTROL,
                    sizing,
                    leadingIcon && 'pl-10',
                    trailingSlot && 'pr-10',
                    invalid && INVALID,
                    className,
                )}
                {...props}
            />
        );

        if (!leadingIcon && !trailingSlot) return control;

        return (
            <div className="relative">
                {leadingIcon && (
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
                        {leadingIcon}
                    </span>
                )}
                {control}
                {trailingSlot && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
                        {trailingSlot}
                    </span>
                )}
            </div>
        );
    },
);

/* ── Textarea ────────────────────────────────────────────────────────────── */

export interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    function Textarea({ className, invalid, rows = 4, ...props }, ref) {
        return (
            <textarea
                ref={ref}
                rows={rows}
                aria-invalid={invalid || undefined}
                className={cn(
                    CONTROL,
                    'min-h-20 resize-y px-3.5 py-2.5 text-sm leading-relaxed',
                    invalid && INVALID,
                    className,
                )}
                {...props}
            />
        );
    },
);

/* ── Select ──────────────────────────────────────────────────────────────── */

export interface SelectProps
    extends React.SelectHTMLAttributes<HTMLSelectElement> {
    invalid?: boolean;
    selectSize?: 'sm' | 'md';
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    function Select(
        { className, invalid, selectSize = 'md', children, ...props },
        ref,
    ) {
        const sizing =
            selectSize === 'sm' ? 'h-9 pl-3 text-[13px]' : 'h-10 pl-3.5 text-sm';

        return (
            <div className="relative">
                <select
                    ref={ref}
                    aria-invalid={invalid || undefined}
                    className={cn(
                        CONTROL,
                        sizing,
                        'cursor-pointer appearance-none pr-9',
                        invalid && INVALID,
                        className,
                    )}
                    {...props}
                >
                    {children}
                </select>
                <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                />
            </div>
        );
    },
);

/* ── Checkbox ────────────────────────────────────────────────────────────── */

export interface CheckboxProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: React.ReactNode;
    hint?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    function Checkbox({ className, label, hint, id, ...props }, ref) {
        const generated = React.useId();
        const inputId = id ?? generated;

        const box = (
            <input
                ref={ref}
                id={inputId}
                type="checkbox"
                className={cn(
                    'size-4 shrink-0 cursor-pointer rounded-[4px] border border-input bg-card',
                    'accent-primary transition-colors',
                    'checked:border-primary checked:bg-primary',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    'disabled:cursor-not-allowed disabled:opacity-55',
                    className,
                )}
                {...props}
            />
        );

        if (!label && !hint) return box;

        return (
            <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex">{box}</span>
                <span className="min-w-0">
                    {label && (
                        <label
                            htmlFor={inputId}
                            className="block cursor-pointer text-sm font-medium text-foreground"
                        >
                            {label}
                        </label>
                    )}
                    {hint && (
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                            {hint}
                        </span>
                    )}
                </span>
            </div>
        );
    },
);

/* ── Switch ──────────────────────────────────────────────────────────────── */

export interface SwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: React.ReactNode;
    hint?: React.ReactNode;
    /** Accessible name when no visible `label` is supplied. */
    'aria-label'?: string;
    id?: string;
    className?: string;
    /** Colour of the "on" track. */
    tone?: 'primary' | 'destructive' | 'success';
}

const SWITCH_TONE: Record<NonNullable<SwitchProps['tone']>, string> = {
    primary: 'bg-primary',
    destructive: 'bg-destructive',
    success: 'bg-success',
};

export function Switch({
    checked,
    onCheckedChange,
    disabled,
    label,
    hint,
    id,
    className,
    tone = 'primary',
    ...aria
}: SwitchProps) {
    const generated = React.useId();
    const inputId = id ?? generated;

    const control = (
        <button
            id={inputId}
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={aria['aria-label']}
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-pill border-2 border-transparent',
                'transition-colors duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                'disabled:cursor-not-allowed disabled:opacity-55',
                checked ? SWITCH_TONE[tone] : 'bg-input',
                className,
            )}
        >
            <span
                className={cn(
                    'pointer-events-none block size-5 rounded-full bg-white shadow-sm ring-0',
                    'transition-transform duration-200',
                    checked ? 'translate-x-5' : 'translate-x-0',
                )}
            />
        </button>
    );

    if (!label && !hint) return control;

    return (
        <div className="flex items-start justify-between gap-4">
            <span className="min-w-0">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block cursor-pointer text-sm font-semibold text-foreground"
                    >
                        {label}
                    </label>
                )}
                {hint && (
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {hint}
                    </span>
                )}
            </span>
            {control}
        </div>
    );
}

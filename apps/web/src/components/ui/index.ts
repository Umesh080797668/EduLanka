/**
 * EduLanka UI kit — single import surface for the design system.
 *
 *   import { Button, Card, PageHeader, StatCard } from '@/components/ui';
 */

export { cn } from '@/lib/cn';

export { Button, buttonClass } from './Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button';

export {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardSeparator,
    CardTitle,
} from './Card';
export type { CardProps } from './Card';

export {
    Checkbox,
    Field,
    Input,
    Label,
    Select,
    Switch,
    Textarea,
} from './Form';
export type {
    CheckboxProps,
    FieldProps,
    InputProps,
    SelectProps,
    SwitchProps,
    TextareaProps,
} from './Form';

export { Badge, Eyebrow } from './Badge';
export type { BadgeProps, BadgeTone, BadgeVariant } from './Badge';

export {
    Table,
    TableWrap,
    TBody,
    TD,
    TDEmpty,
    TFoot,
    TH,
    THead,
    TR,
} from './Table';

export { EmptyState, PageHeader, SectionHeading } from './Layout';
export type { EmptyStateProps, PageHeaderProps } from './Layout';

export { Progress, StatCard } from './Stat';
export type { ProgressProps, StatCardProps, StatTone } from './Stat';

export { Alert, Note } from './Alert';
export type { AlertProps, AlertTone } from './Alert';

export { ConfirmDialog, Dialog } from './Dialog';
export type { DialogProps } from './Dialog';

export { Tabs } from './Tabs';
export type { TabItem, TabsProps } from './Tabs';

export { Avatar, AvatarStack, initialsOf } from './Avatar';
export type { AvatarProps } from './Avatar';

export {
    DashboardCardsSkeleton,
    PageSkeleton,
    Skeleton,
    TableRowsSkeleton,
} from './Skeleton';

export { FullPageSpinner, Spinner } from './Spinner';
export type { SpinnerProps } from './Spinner';

export { LanguageSwitcher } from './LanguageSwitcher';
export { ThemeToggle } from './ThemeToggle';

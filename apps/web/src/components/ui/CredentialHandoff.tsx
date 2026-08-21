'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, CheckCircle2, Copy } from 'lucide-react';

import { Button } from '@/components/ui/Button';

export interface CredentialHandoffLabels {
    title: string;
    subtitle: string;
    intro: string;
    emailLabel: string;
    passwordLabel: string;
    copyLabel: string;
    addAnother: string;
    returnLabel: string;
}

interface CredentialHandoffProps {
    email: string;
    tempPassword: string;
    labels: CredentialHandoffLabels;
    onAddAnother: () => void;
    /** Rendered as-is so the caller controls the destination Link. */
    returnAction: React.ReactNode;
}

/**
 * Post-provisioning credentials screen shared by the teacher and parent
 * creation forms — the only moment the temporary password is ever visible.
 */
export function CredentialHandoff({
    email,
    tempPassword,
    labels,
    onAddAnother,
    returnAction,
}: CredentialHandoffProps) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(tempPassword);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            /* Clipboard unavailable — the value stays visible for manual copy. */
        }
    };

    return (
        <div className="mx-auto max-w-2xl">
            <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden rounded-card border border-border bg-card shadow-card"
            >
                <div className="flex flex-col items-center gap-3 border-b border-border bg-success-subtle px-8 py-10 text-center">
                    <span className="grid size-16 place-items-center rounded-full bg-success/15 text-success">
                        <CheckCircle2 className="size-8" />
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                        {labels.title}
                    </h2>
                    <p className="text-sm font-medium text-muted-foreground">
                        {labels.subtitle}
                    </p>
                </div>

                <div className="px-6 py-8 sm:px-8">
                    <p className="mb-6 text-center text-sm text-muted-foreground">
                        {labels.intro}
                    </p>

                    <dl className="space-y-4 rounded-card border border-border bg-muted/40 p-5">
                        <div>
                            <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {labels.emailLabel}
                            </dt>
                            <dd className="rounded-input border border-border bg-card px-3 py-2 font-mono text-sm text-foreground">
                                {email}
                            </dd>
                        </div>
                        <div>
                            <dt className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {labels.passwordLabel}
                            </dt>
                            <dd className="flex items-center gap-2">
                                <code className="flex-1 truncate rounded-input border border-border bg-card px-3 py-2 font-mono text-base font-bold text-foreground">
                                    {tempPassword}
                                </code>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={copy}
                                    aria-label={labels.copyLabel}
                                    title={labels.copyLabel}
                                >
                                    {copied ? (
                                        <Check className="size-4 text-success" />
                                    ) : (
                                        <Copy className="size-4" />
                                    )}
                                </Button>
                            </dd>
                        </div>
                    </dl>

                    <div className="mt-8 flex flex-col justify-center gap-3 border-t border-border pt-6 sm:flex-row">
                        <Button variant="outline" onClick={onAddAnother}>
                            {labels.addAnother}
                        </Button>
                        {returnAction}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default CredentialHandoff;

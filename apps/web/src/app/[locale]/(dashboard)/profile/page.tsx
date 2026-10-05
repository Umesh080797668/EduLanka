'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Form';
import { PageHeader } from '@/components/ui/Layout';

interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: string;
    phone_number?: string | null;
    preferred_language?: string | null;
}

export default function ProfilePage() {
    const t = useTranslations('Profile');
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Profile form state
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [preferredLanguage, setPreferredLanguage] = useState('en');
    const [savingProfile, setSavingProfile] = useState(false);

    // Password form state
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await apiClient.get<UserProfile>('/users/me', {
                    skipGlobalToast: true,
                });
                if (data) {
                    setProfile(data);
                    setFullName(data.full_name || '');
                    setPhoneNumber(data.phone_number || '');
                    setPreferredLanguage(data.preferred_language || 'en');
                }
            } catch {
                toast.error('Failed to load profile.');
            } finally {
                setLoading(false);
            }
        };

        void fetchProfile();
    }, []);

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            const updated = await apiClient.patch<UserProfile>(
                '/users/me',
                {
                    fullName,
                    phoneNumber,
                    preferredLanguage,
                },
                { skipGlobalToast: true },
            );
            if (updated) {
                setProfile(updated);
            }
            toast.success(t('profileUpdated'));
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update profile.');
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 8) {
            toast.error(t('passwordMinLength'));
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error(t('passwordMismatch'));
            return;
        }

        setChangingPassword(true);
        try {
            await apiClient.post(
                '/auth/change-password',
                {
                    oldPassword,
                    newPassword,
                },
                { skipGlobalToast: true },
            );
            toast.success(t('passwordChanged'));
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to change password.');
        } finally {
            setChangingPassword(false);
        }
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-4xl space-y-6">
                <div className="h-20 animate-pulse rounded-card bg-muted/40" />
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="h-64 animate-pulse rounded-card bg-muted/40" />
                    <div className="h-64 animate-pulse rounded-card bg-muted/40" />
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <PageHeader
                icon={<User />}
                title={t('title')}
                description={t('subtitle')}
            />

            <div className="grid gap-6 md:grid-cols-2">
                {/* Personal Information */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle as="h2" className="flex items-center gap-2">
                                    <User className="size-4 text-brand-600 dark:text-brand-400" />
                                    {t('personalInfo')}
                                </CardTitle>
                                <Badge size="sm" variant="soft" tone="primary">
                                    {profile?.role || 'USER'}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleProfileSubmit} className="space-y-4">
                                <Field label={t('email')} htmlFor="profile-email" hint={t('emailHint')}>
                                    <Input
                                        id="profile-email"
                                        disabled
                                        value={profile?.email || ''}
                                        className="bg-muted cursor-not-allowed opacity-75"
                                    />
                                </Field>

                                <Field label={t('fullName')} htmlFor="profile-name" required>
                                    <Input
                                        id="profile-name"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </Field>

                                <Field label={t('phoneNumber')} htmlFor="profile-phone">
                                    <Input
                                        id="profile-phone"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        placeholder="+94 7X XXX XXXX"
                                    />
                                </Field>

                                <Field label={t('language')} htmlFor="profile-language">
                                    <Select
                                        id="profile-language"
                                        value={preferredLanguage}
                                        onChange={(e) => setPreferredLanguage(e.target.value)}
                                    >
                                        <option value="en">English</option>
                                        <option value="si">සිංහල (Sinhala)</option>
                                        <option value="ta">தமிழ் (Tamil)</option>
                                    </Select>
                                </Field>

                                <div className="pt-2">
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        loading={savingProfile}
                                        leadingIcon={<Save />}
                                        block
                                    >
                                        {t('saveChanges')}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Account Security & Password Change */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle as="h2" className="flex items-center gap-2">
                                <Lock className="size-4 text-accent-600 dark:text-accent-400" />
                                {t('security')}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('changePasswordDesc')}
                            </p>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                <Field label={t('currentPassword')} htmlFor="pwd-current" required>
                                    <Input
                                        id="pwd-current"
                                        type="password"
                                        required
                                        value={oldPassword}
                                        onChange={(e) => setOldPassword(e.target.value)}
                                    />
                                </Field>

                                <Field label={t('newPassword')} htmlFor="pwd-new" required>
                                    <Input
                                        id="pwd-new"
                                        type="password"
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        minLength={8}
                                    />
                                </Field>

                                <Field label={t('confirmPassword')} htmlFor="pwd-confirm" required>
                                    <Input
                                        id="pwd-confirm"
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        minLength={8}
                                    />
                                </Field>

                                <div className="pt-2">
                                    <Button
                                        type="submit"
                                        variant="secondary"
                                        loading={changingPassword}
                                        leadingIcon={<Lock />}
                                        block
                                    >
                                        {t('updatePassword')}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}

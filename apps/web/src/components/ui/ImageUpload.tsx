'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, ImageIcon, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { authManager } from '@/lib/auth-store';
import { getUploadSignature, RequestOpts } from '@/lib/api/school';

interface ImageUploadProps {
    currentImageUrl?: string | null;
    onUploadSuccess: (url: string) => void;
    onError: (err: string) => void;
    size?: number;
    className?: string;
}

export default function ImageUpload({
    currentImageUrl,
    onUploadSuccess,
    onError,
    size = 120,
    className,
}: ImageUploadProps) {
    const t = useTranslations('Forms');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            onError(t('invalidImage'));
            return;
        }

        setUploading(true);

        try {
            // Retrieve secure signature from backend
            const opts: RequestOpts = {
                token: authManager.getToken() || '',
                tenantId: authManager.getTenantId() || '',
            };
            const sigRes = await getUploadSignature(opts);
            const { timestamp, signature, folder, apiKey } = sigRes;

            // Form Cloudinary payload
            const formData = new FormData();
            formData.append('file', file);
            formData.append('api_key', apiKey);
            formData.append('timestamp', timestamp.toString());
            formData.append('signature', signature);
            formData.append('folder', folder);

            const cloudName =
                process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dx2c48mou';

            const res = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                { method: 'POST', body: formData },
            );

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || t('uploadFailed'));
            }
            const data = await res.json();
            onUploadSuccess(data.secure_url);
        } catch (err: any) {
            onError(err.message || t('uploadFailed'));
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div
            className={cn('group relative inline-block', className)}
            style={{ width: size, height: size }}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg, image/png, image/webp"
                className="hidden"
            />

            <div className="relative flex size-full items-center justify-center overflow-hidden rounded-card border border-border bg-muted shadow-xs">
                {currentImageUrl ? (
                    <Image
                        src={currentImageUrl}
                        alt=""
                        fill
                        sizes={`${size}px`}
                        className="object-cover"
                    />
                ) : (
                    <ImageIcon className="size-1/3 text-muted-foreground/50" />
                )}

                {/* Hover overlay — type="button" so it never submits the parent form. */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    aria-label={t('updatePhoto')}
                    className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-scrim/50 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed"
                >
                    <Camera className="mb-1 size-6" />
                    <span className="text-xs font-medium">{t('updatePhoto')}</span>
                </button>

                {uploading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                        <Loader2 className="size-6 animate-spin text-primary" />
                    </div>
                )}
            </div>
        </div>
    );
}

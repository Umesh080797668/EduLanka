'use client';
import { useState, useRef } from 'react';
import { Camera, Loader2, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { getUploadSignature, RequestOpts } from '@/lib/api/school';
import { authManager } from '@/lib/auth-store';

interface ImageUploadProps {
    currentImageUrl?: string | null;
    onUploadSuccess: (url: string) => void;
    onError: (err: string) => void;
    size?: number;
    className?: string;
}

export default function ImageUpload({ currentImageUrl, onUploadSuccess, onError, size = 120, className = '' }: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            onError('Please upload a valid image file (jpeg, png, etc)');
            return;
        }

        setUploading(true);

        try {
            // Retrieve secure signature from backend
            const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
            const sigRes = await getUploadSignature(opts);
            const { timestamp, signature, folder, apiKey } = sigRes;

            // Form Cloudinary Payload
            const formData = new FormData();
            formData.append('file', file);
            formData.append('api_key', apiKey);
            formData.append('timestamp', timestamp.toString());
            formData.append('signature', signature);
            formData.append('folder', folder);

            const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dx2c48mou'; // A fallback or requires actual env

            const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error?.message || 'Upload failed');
            }
            const data = await res.json();
            onUploadSuccess(data.secure_url);
        } catch (err: any) {
            onError(err.message || 'Error uploading image');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className={`relative group inline-block ${className}`} style={{ width: size, height: size }}>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg, image/png, image/webp"
                className="hidden"
            />

            <div
                className="w-full h-full rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center border-4 border-white shadow-md relative"
            >
                {currentImageUrl ? (
                    <Image
                        src={currentImageUrl}
                        alt="Profile avatar"
                        fill
                        sizes={`${size}px`}
                        className="object-cover"
                    />
                ) : (
                    <ImageIcon className="w-1/3 h-1/3 text-slate-300" />
                )}

                {/* Hover overlay */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer disabled:cursor-not-allowed"
                >
                    {uploading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <>
                            <Camera className="w-6 h-6 mb-1" />
                            <span className="text-xs font-medium">Update</span>
                        </>
                    )}
                </button>

                {uploading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 backdrop-blur-sm">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    </div>
                )}
            </div>
        </div>
    );
}

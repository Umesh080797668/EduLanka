import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UploadService {
    getSignature(tenantId?: string) {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const folder = tenantId ? `edulanka/${tenantId}/profiles` : 'edulanka/profiles';

        const secret = process.env.CLOUDINARY_API_SECRET;
        const apiKey = process.env.CLOUDINARY_API_KEY;

        if (!secret || !apiKey) {
            throw new InternalServerErrorException('Cloudinary credentials are not configured on the server.');
        }

        const allowedFormats = 'jpg,png,jpeg,webp';
        const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
        const signParams: Record<string, any> = {
            timestamp,
            folder,
            allowed_formats: allowedFormats,
        };
        if (uploadPreset) {
            signParams.upload_preset = uploadPreset;
        }

        const signature = cloudinary.utils.api_sign_request(
            signParams,
            secret
        );

        return {
            timestamp,
            folder,
            signature,
            apiKey,
            allowedFormats,
            uploadPreset: uploadPreset || null,
            maxFileSize: 5 * 1024 * 1024,
        };
    }
}

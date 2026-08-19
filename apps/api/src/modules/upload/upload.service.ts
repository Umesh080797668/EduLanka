import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UploadService {
    getSignature() {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const folder = 'edulanka/profiles'; // Store in a dedicated folder

        const secret = process.env.CLOUDINARY_API_SECRET;
        const apiKey = process.env.CLOUDINARY_API_KEY;

        if (!secret || !apiKey) {
            throw new InternalServerErrorException('Cloudinary credentials are not configured on the server.');
        }

        const signature = cloudinary.utils.api_sign_request(
            { timestamp, folder },
            secret
        );

        return {
            timestamp,
            folder,
            signature,
            apiKey
        };
    }
}

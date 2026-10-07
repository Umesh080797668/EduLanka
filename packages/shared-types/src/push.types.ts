export enum DevicePlatform {
    ANDROID = 'android',
    IOS = 'ios',
    WEB = 'web',
}

export interface DeviceToken {
    id: string;
    tenant_id: string;
    user_id: string;
    token: string;
    platform: DevicePlatform;
    device_model?: string | null;
    is_active: boolean;
    last_seen_at: string;
    created_at: string;
    updated_at: string;
}

export interface RegisterDeviceTokenDto {
    token: string;
    platform: DevicePlatform;
    device_model?: string;
}

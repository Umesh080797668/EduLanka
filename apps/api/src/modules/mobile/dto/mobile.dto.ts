import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn, IsOptional, Matches, IsBoolean } from 'class-validator';

import { IsUuidString } from '../../../common/decorators/is-uuid-string.decorator';

export class RegisterDeviceTokenDto {
    @ApiProperty({ description: 'FCM registration device token' })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({ enum: ['android', 'ios', 'web'], description: 'Client platform' })
    @IsIn(['android', 'ios', 'web'])
    platform: 'android' | 'ios' | 'web';

    @ApiPropertyOptional({ description: 'Hardware device model' })
    @IsOptional()
    @IsString()
    deviceModel?: string;
}

export const ALLOWED_SYNC_ENTITY_TYPES = [
    'attendance',
    'homework_submission',
    'chat_message',
    'disaster_mode',
    'entitlement_revocation',
    'blog_post',
    'blog_comment',
    'blog_reaction'
] as const;

export type SyncEntityType = (typeof ALLOWED_SYNC_ENTITY_TYPES)[number];

export class AppendSyncEventDto {
    @ApiProperty({
        description: 'Domain entity type e.g. attendance, homework_submission, chat_message, disaster_mode',
        enum: ALLOWED_SYNC_ENTITY_TYPES,
    })
    @IsIn(ALLOWED_SYNC_ENTITY_TYPES)
    entityType: SyncEntityType;

    @ApiProperty({ description: 'Strong UUID of the entity' })
    @IsUuidString()
    entityId: string;

    @ApiProperty({ enum: ['CREATED', 'UPDATED', 'DELETED'] })
    @IsIn(['CREATED', 'UPDATED', 'DELETED'])
    eventType: 'CREATED' | 'UPDATED' | 'DELETED';

    @ApiPropertyOptional({ description: 'Event payload JSON (max 64KB)' })
    @IsOptional()
    payload?: Record<string, any>;

    @ApiProperty({ description: 'Client UUID for idempotency deduplication' })
    @IsUuidString()
    clientUuid: string;
}

export class TriggerDisasterPushDto {
    @ApiPropertyOptional({ description: 'Target school tenant ID (SUPER_ADMIN only)' })
    @IsOptional()
    @IsUuidString()
    schoolTenantId?: string;

    @ApiPropertyOptional({ description: 'Emergency reason' })
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiPropertyOptional({ description: 'Expected duration e.g. 3_DAYS' })
    @IsOptional()
    @IsString()
    expectedDuration?: string;
}

export class UpsertEmergencyContactDto {
    @ApiPropertyOptional({ description: 'Emergency contact UUID (if updating existing contact)' })
    @IsOptional()
    @IsUuidString()
    id?: string;

    @ApiProperty({ description: 'Contact person or service name' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiProperty({ description: 'Role or designation (e.g. Principal, First Aid Officer, Fire Station)' })
    @IsString()
    @IsNotEmpty()
    role!: string;

    @ApiProperty({ description: 'Contact phone number' })
    @IsString()
    @IsNotEmpty()
    phone!: string;

    @ApiPropertyOptional({ description: 'Whether this is the primary emergency contact' })
    @IsOptional()
    isPrimary?: boolean;

    @ApiPropertyOptional({ description: 'Display order priority' })
    @IsOptional()
    displayOrder?: number;
}

export class UpsertShelterDto {
    @ApiPropertyOptional({ description: 'Shelter UUID (if updating existing shelter)' })
    @IsOptional()
    @IsUuidString()
    id?: string;

    @ApiProperty({ description: 'Shelter name' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiProperty({ description: 'Shelter physical address or location' })
    @IsString()
    @IsNotEmpty()
    address!: string;

    @ApiPropertyOptional({ description: 'Capacity of occupants' })
    @IsOptional()
    capacity?: number;

    @ApiPropertyOptional({ description: 'GPS Latitude' })
    @IsOptional()
    gpsLat?: number;

    @ApiPropertyOptional({ description: 'GPS Longitude' })
    @IsOptional()
    gpsLng?: number;

    @ApiPropertyOptional({ description: 'Additional instructions or facilities' })
    @IsOptional()
    @IsString()
    notes?: string;
}

export class UpdateMobileVersionDto {
    @ApiPropertyOptional({ description: 'Target platform', enum: ['android', 'ios', 'all'], default: 'android' })
    @IsOptional()
    @IsIn(['android', 'ios', 'all'])
    platform?: 'android' | 'ios' | 'all';

    @ApiProperty({ description: 'Minimum supported semver string (e.g. 1.0.0)' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d+\.\d+\.\d+$/, { message: 'minVersion must be a valid semver string (e.g. 1.0.0)' })
    minVersion!: string;

    @ApiProperty({ description: 'Latest release semver string (e.g. 1.1.0)' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d+\.\d+\.\d+$/, { message: 'latestVersion must be a valid semver string (e.g. 1.1.0)' })
    latestVersion!: string;

    @ApiPropertyOptional({ description: 'Release notes or change summary' })
    @IsOptional()
    @IsString()
    releaseNotes?: string;

    @ApiPropertyOptional({ description: 'Whether to force an immediate update' })
    @IsOptional()
    @IsBoolean()
    forceUpdate?: boolean;
}



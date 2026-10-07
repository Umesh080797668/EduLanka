import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

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

export class AppendSyncEventDto {
    @ApiProperty({ description: 'Domain entity type e.g. attendance, chat_message' })
    @IsString()
    @IsNotEmpty()
    entityType: string;

    @ApiProperty({ description: 'Strong UUID of the entity' })
    @IsUuidString()
    entityId: string;

    @ApiProperty({ enum: ['CREATED', 'UPDATED', 'DELETED'] })
    @IsIn(['CREATED', 'UPDATED', 'DELETED'])
    eventType: 'CREATED' | 'UPDATED' | 'DELETED';

    @ApiPropertyOptional({ description: 'Event payload JSON' })
    @IsOptional()
    payload?: Record<string, any>;

    @ApiProperty({ description: 'Client UUID for idempotency deduplication' })
    @IsUuidString()
    clientUuid: string;
}

export class TriggerDisasterPushDto {
    @ApiPropertyOptional({ description: 'Emergency reason' })
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiPropertyOptional({ description: 'Expected duration e.g. 3_DAYS' })
    @IsOptional()
    @IsString()
    expectedDuration?: string;
}

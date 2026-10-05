import { Type } from 'class-transformer';
import {
    IsString,
    IsEnum,
    IsOptional,
    IsUUID,
    IsInt,
    IsBoolean,
    IsArray,
    Min,
    Max,
    IsNotEmpty,
} from 'class-validator';

export enum NoticeScope {
    UNIVERSAL = 'UNIVERSAL',
    SCHOOL_WIDE = 'SCHOOL_WIDE',
    GRADE_LEVEL = 'GRADE_LEVEL',
    CLASS_SPECIFIC = 'CLASS_SPECIFIC',
}

export enum NoticePriority {
    LOW = 'LOW',
    NORMAL = 'NORMAL',
    HIGH = 'HIGH',
    URGENT = 'URGENT',
}

export class CreateNoticeDto {
    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsString()
    @IsNotEmpty()
    content_html!: string;

    @IsEnum(NoticeScope)
    scope!: NoticeScope;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    @Min(1)
    @Max(13)
    target_grade?: number;

    @IsOptional()
    @IsUUID()
    target_class_id?: string;

    @IsOptional()
    @IsEnum(NoticePriority)
    priority?: NoticePriority = NoticePriority.NORMAL;

    @IsOptional()
    @IsArray()
    attachments?: any[];

    @IsOptional()
    @IsString()
    expires_at?: string;

    @IsOptional()
    @IsBoolean()
    send_sms?: boolean;

    @IsOptional()
    @IsBoolean()
    bypass_quota?: boolean;

    @IsOptional()
    @IsBoolean()
    requires_acknowledgment?: boolean;
}

export class UpdateNoticeDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    title?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    content_html?: string;

    @IsOptional()
    @IsEnum(NoticeScope)
    scope?: NoticeScope;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    @Min(1)
    @Max(13)
    target_grade?: number;

    @IsOptional()
    @IsUUID()
    target_class_id?: string;

    @IsOptional()
    @IsEnum(NoticePriority)
    priority?: NoticePriority;

    @IsOptional()
    @IsArray()
    attachments?: any[];

    @IsOptional()
    @IsString()
    expires_at?: string;

    @IsOptional()
    @IsBoolean()
    requires_acknowledgment?: boolean;
}

export class CreateMaintenanceNoticeDto {
    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsString()
    @IsNotEmpty()
    message!: string;

    @IsOptional()
    @IsEnum(['INFO', 'WARNING', 'CRITICAL'])
    severity?: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO';

    @IsOptional()
    @IsString()
    scheduledStart?: string;

    @IsOptional()
    @IsString()
    scheduledEnd?: string;
}

export class BroadcastNoticeDto {
    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsString()
    @IsNotEmpty()
    content_html!: string;

    @IsOptional()
    @IsBoolean()
    send_sms?: boolean;
}

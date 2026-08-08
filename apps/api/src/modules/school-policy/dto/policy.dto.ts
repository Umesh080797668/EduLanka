// =============================================================================
// School Policy Module DTOs
// =============================================================================
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Max,
    Min,
    Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InstructionMedium } from '@edu-lanka/shared-types';

export class UpdatePolicyDto {
    @ApiPropertyOptional({ description: 'Academic year', example: 2026 })
    @IsInt()
    @Min(2000)
    @Max(2100)
    @IsOptional()
    academicYear?: number;

    @ApiPropertyOptional({ description: 'Max students per class (5-60)', example: 40 })
    @IsInt()
    @Min(5)
    @Max(60)
    @IsOptional()
    maxStudentsPerClass?: number;

    @ApiPropertyOptional()
    @IsBoolean()
    @IsOptional()
    allowSelfEnrollment?: boolean;

    @ApiPropertyOptional()
    @IsBoolean()
    @IsOptional()
    smsEnabled?: boolean;

    @ApiPropertyOptional({ enum: ['en', 'si', 'ta'] })
    @IsEnum(['en', 'si', 'ta'])
    @IsOptional()
    defaultLanguage?: 'en' | 'si' | 'ta';

    @ApiPropertyOptional({ enum: InstructionMedium, isArray: true })
    @IsEnum(InstructionMedium, { each: true })
    @IsOptional()
    supportedMediums?: InstructionMedium[];

    @ApiPropertyOptional({ description: 'IANA timezone', example: 'Asia/Colombo' })
    @IsString()
    @IsOptional()
    timezone?: string;

    @ApiPropertyOptional({ description: 'School start time HH:MM:SS', example: '07:30:00' })
    @IsString()
    @Matches(/^\d{2}:\d{2}:\d{2}$/, { message: 'Must be HH:MM:SS format' })
    @IsOptional()
    schoolHoursStart?: string;

    @ApiPropertyOptional({ description: 'School end time HH:MM:SS', example: '14:00:00' })
    @IsString()
    @Matches(/^\d{2}:\d{2}:\d{2}$/, { message: 'Must be HH:MM:SS format' })
    @IsOptional()
    schoolHoursEnd?: string;
}

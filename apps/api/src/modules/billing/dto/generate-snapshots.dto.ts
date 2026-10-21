import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateBillingSnapshotsDto {
    @ApiPropertyOptional({
        description: 'Billing month in YYYY-MM format',
        example: '2026-10',
    })
    @IsOptional()
    @IsString()
    @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
        message: 'billingMonth must be in YYYY-MM format (e.g. 2026-10)',
    })
    billingMonth?: string;
}

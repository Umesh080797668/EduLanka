import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IndividualCheckoutDto {
    @ApiProperty({
        description: 'Target individual subscription tier',
        enum: ['INDIVIDUAL_PRO', 'INDIVIDUAL_PREMIUM'],
        example: 'INDIVIDUAL_PRO',
    })
    @IsEnum(['INDIVIDUAL_PRO', 'INDIVIDUAL_PREMIUM'], {
        message: 'Plan must be either INDIVIDUAL_PRO or INDIVIDUAL_PREMIUM',
    })
    plan: 'INDIVIDUAL_PRO' | 'INDIVIDUAL_PREMIUM';

    @ApiPropertyOptional({
        description: 'Billing cadence duration',
        enum: ['MONTHLY', 'ANNUAL'],
        default: 'MONTHLY',
    })
    @IsOptional()
    @IsEnum(['MONTHLY', 'ANNUAL'])
    billingCycle?: 'MONTHLY' | 'ANNUAL';
}

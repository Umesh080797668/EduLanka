import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

import { IsUuidString } from '../../../common/decorators/is-uuid-string.decorator';

export class ForgotPasswordDto {
    @ApiProperty({ example: 'john.doe@school.edu.lk' })
    @IsEmail()
    email!: string;

    @ApiPropertyOptional({ description: 'Tenant UUID (optional)' })
    @IsOptional()
    @IsUuidString()
    tenantId?: string;
}


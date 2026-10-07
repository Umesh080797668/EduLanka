import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional } from 'class-validator';

import { IsUuidString } from '../../../common/decorators/is-uuid-string.decorator';

export class LoginDto {
    /** Identifier (Email, Phone, Admission No) */
    @ApiProperty({ example: 'admin@school.edu.lk' })
    @IsString()
    @IsOptional()
    identifier?: string;

    /** Legacy Email Fallback */
    @ApiPropertyOptional({ example: 'admin@school.edu.lk' })
    @IsString()
    @IsOptional()
    email?: string;

    /** Password — min 8 characters */
    @ApiProperty({ example: 'SecurePass123!' })
    @IsString()
    @MinLength(8)
    password!: string;

    /** School Tenant ID (required if admission number is shared across schools) */
    @ApiPropertyOptional({ example: '45f9722b-eda0-453f-88d2-2c9ad06ec169' })
    @IsOptional()
    @IsUuidString()
    tenantId?: string;
}

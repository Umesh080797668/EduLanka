import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, MaxLength, Matches } from 'class-validator';

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
    @ApiProperty({ example: 'Example123!' })
    @IsString()
    @MinLength(8)
    password!: string;

    /** School Tenant ID or School Slug (e.g. 'dev-school' or UUID, max 100 chars) */
    @ApiPropertyOptional({ example: 'dev-school' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'tenantId must only contain alphanumeric characters, underscores, or hyphens' })
    tenantId?: string;
}

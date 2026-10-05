import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional } from 'class-validator';

export class ForgotPasswordDto {
    @ApiProperty({ example: 'john.doe@school.edu.lk' })
    @IsEmail()
    email!: string;

    @ApiPropertyOptional({ description: 'Tenant UUID (optional)' })
    @IsString()
    @IsOptional()
    tenantId?: string;
}


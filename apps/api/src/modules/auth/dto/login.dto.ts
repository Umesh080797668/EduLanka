import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional } from 'class-validator';

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

}

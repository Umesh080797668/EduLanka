import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

export class LoginDto {
    /** School Admin / Staff email address */
    @ApiProperty({ example: 'admin@school.edu.lk' })
    @IsEmail()
    email!: string;

    /** Password — min 8 characters */
    @ApiProperty({ example: 'SecurePass123!' })
    @IsString()
    @MinLength(8)
    password!: string;

    /** Target tenant UUID to log into */
    @ApiProperty({ example: 'aaaa-bbbb-...' })
    @IsString()
    @IsNotEmpty()
    tenantId!: string;
}

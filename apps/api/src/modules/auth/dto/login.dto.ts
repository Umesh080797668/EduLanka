import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
    /** Identifier (Email, Phone, Admission No) */
    @ApiProperty({ example: 'admin@school.edu.lk' })
    @IsString()
    identifier!: string;

    /** Password — min 8 characters */
    @ApiProperty({ example: 'SecurePass123!' })
    @IsString()
    @MinLength(8)
    password!: string;

}

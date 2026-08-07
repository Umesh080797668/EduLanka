import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
    @ApiProperty({ example: 'john.doe@school.edu.lk' })
    @IsEmail()
    email!: string;

    @ApiProperty({ description: 'Tenant UUID (used to build the reset redirect URL)' })
    @IsString()
    @IsNotEmpty()
    tenantId!: string;
}

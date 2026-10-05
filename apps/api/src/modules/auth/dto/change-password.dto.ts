import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
    @ApiProperty({ description: 'Current password for verification', example: 'CurrentSecret123!' })
    @IsString()
    @IsNotEmpty()
    currentPassword: string;

    @ApiProperty({ description: 'New password (min 8 characters)', example: 'NewSecret456!' })
    @IsString()
    @MinLength(8, { message: 'New password must be at least 8 characters long' })
    newPassword: string;
}

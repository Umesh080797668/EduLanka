import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateUserDto {
    @ApiPropertyOptional({ description: 'User full name' })
    @IsString()
    @IsOptional()
    fullName?: string;

    @ApiPropertyOptional({ description: 'Phone number' })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Avatar image URL' })
    @IsUrl()
    @IsOptional()
    avatarUrl?: string;
}

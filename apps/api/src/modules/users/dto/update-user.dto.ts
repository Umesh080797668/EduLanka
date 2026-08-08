import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    fullName?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    phoneNumber?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class LogoutDto {
    @ApiPropertyOptional({ description: 'The refresh JWT to revoke, if available' })
    @IsString()
    @IsOptional()
    refreshToken?: string;
}

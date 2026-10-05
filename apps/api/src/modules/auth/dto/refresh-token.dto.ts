import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class RefreshTokenDto {
    @ApiPropertyOptional({ description: 'The refresh JWT issued at login or previous refresh (falls back to cookie if omitted)' })
    @IsString()
    @IsOptional()
    refreshToken?: string;
}

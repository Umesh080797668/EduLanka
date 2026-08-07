import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
    @ApiProperty({ description: 'The refresh JWT issued at login or previous refresh' })
    @IsString()
    @IsNotEmpty()
    refreshToken!: string;
}

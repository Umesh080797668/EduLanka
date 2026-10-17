import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TakedownBlogDto {
    @ApiProperty({ description: 'Administrative reason for taking down this blog post', example: 'Violates curriculum standards' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    reason!: string;
}

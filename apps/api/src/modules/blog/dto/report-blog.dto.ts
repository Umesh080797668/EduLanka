import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReportBlogDto {
    @ApiProperty({ description: 'Reason for reporting this blog post', example: 'Inappropriate language or academic misconduct' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    reason!: string;
}

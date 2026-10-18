import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReportBlogDto {
    @ApiProperty({ description: 'Reason for reporting this blog post', example: 'Inappropriate language or academic misconduct' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    reason!: string;
}

export class ResolveReportDto {
    @ApiProperty({ description: 'Resolution status for this blog report', enum: ['RESOLVED', 'DISMISSED'] })
    @IsString()
    @IsIn(['RESOLVED', 'DISMISSED'])
    status!: 'RESOLVED' | 'DISMISSED';
}

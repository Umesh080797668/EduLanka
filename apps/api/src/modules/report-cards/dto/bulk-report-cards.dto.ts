import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { IsUuidString } from '../../../common/decorators/is-uuid-string.decorator';

export class BulkReportCardsDto {
    @ApiProperty({ description: 'Academic term (1, 2, or 3)', example: 1 })
    @IsInt()
    @Min(1)
    @Max(3)
    term: number;

    @ApiProperty({ description: 'Academic year', example: 2026 })
    @IsInt()
    @Min(2000)
    @Max(2100)
    academicYear: number;

    @ApiPropertyOptional({ description: 'Optional class UUID filter' })
    @IsOptional()
    @IsUuidString()
    classId?: string;
}

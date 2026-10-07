import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max } from 'class-validator';

import { IsUuidString } from '../../../common/decorators/is-uuid-string.decorator';

export class QueryAuditLogsDto {
    @ApiPropertyOptional({ default: 50, description: 'Number of logs to retrieve' })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(200)
    @Type(() => Number)
    limit?: number = 50;

    @ApiPropertyOptional({ default: 0, description: 'Offset for pagination' })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Type(() => Number)
    offset?: number = 0;

    @ApiPropertyOptional({ description: 'Filter by actor or entity user UUID' })
    @IsOptional()
    @IsUuidString()
    targetUserId?: string;
}

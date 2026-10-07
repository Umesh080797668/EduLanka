// =============================================================================
// Classes Module DTOs
// =============================================================================
import { SubjectArea, InstructionMedium } from '@edu-lanka/shared-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsInt,
    IsNotEmpty,
    IsString,
    IsOptional,
    IsBoolean,
    IsEnum,
    Min,
    Max,
    Length,
} from 'class-validator';

import { IsUuidString } from '../../../common/decorators/is-uuid-string.decorator';

export class CreateClassDto {
    @ApiProperty({ description: 'Grade UUID referencing grades table' })
    @IsNotEmpty()
    @IsUuidString()
    gradeId!: string;

    @ApiProperty({ description: 'Section label', example: 'A' })
    @IsString()
    @IsNotEmpty()
    @Length(1, 10)
    section!: string;

    @ApiPropertyOptional({ enum: InstructionMedium, description: 'Teaching medium' })
    @IsEnum(InstructionMedium)
    @IsOptional()
    medium?: InstructionMedium;

    @ApiProperty({ description: 'Academic year', example: 2026 })
    @IsInt()
    @Min(2000)
    @Max(2100)
    year!: number;
}

export class UpdateClassDto {
    @ApiPropertyOptional({ description: 'Section label', example: 'B' })
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    section?: string;

    @ApiPropertyOptional({ enum: InstructionMedium, description: 'Teaching medium' })
    @IsEnum(InstructionMedium)
    @IsOptional()
    medium?: InstructionMedium;

    @ApiPropertyOptional({ description: 'Academic year', example: 2026 })
    @IsInt()
    @Min(2000)
    @Max(2100)
    @IsOptional()
    year?: number;
}

export class AssignTeacherDto {
    @ApiProperty({ description: 'Teacher UUID' })
    @IsNotEmpty()
    @IsUuidString()
    teacherId!: string;

    @ApiPropertyOptional({ description: 'Is this the homeroom teacher?' })
    @IsBoolean()
    @IsOptional()
    isHomeroom?: boolean;

    @ApiPropertyOptional({ enum: SubjectArea, description: 'Subject this teacher handles for this class' })
    @IsEnum(SubjectArea)
    @IsOptional()
    subject?: SubjectArea;
}

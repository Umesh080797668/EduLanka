// =============================================================================
// Classes Module DTOs
// =============================================================================
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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubjectArea, InstructionMedium } from '@edu-lanka/shared-types';

export class CreateClassDto {
    @ApiProperty({ description: 'Grade level (1-13)', minimum: 1, maximum: 13, example: 9 })
    @IsInt()
    @Min(1)
    @Max(13)
    grade!: number;

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
    @IsString()
    @IsNotEmpty()
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

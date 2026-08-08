import {
    IsInt,
    IsNotEmpty,
    IsString,
    IsOptional,
    IsBoolean,
    Min,
    Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGradeDto {
    @ApiProperty({ description: 'Grade level (1-15)', example: 10 })
    @IsInt()
    @Min(1)
    @Max(15)
    level!: number;

    @ApiProperty({ description: 'Grade display name', example: 'Grade 10' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiPropertyOptional({ description: 'Curriculum type', example: 'O_LEVEL' })
    @IsString()
    @IsOptional()
    curriculumType?: string;
}

export class UpdateGradeDto {
    @ApiPropertyOptional({ description: 'Grade level (1-15)', example: 10 })
    @IsInt()
    @Min(1)
    @Max(15)
    @IsOptional()
    level?: number;

    @ApiPropertyOptional({ description: 'Grade display name', example: 'Grade 10' })
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({ description: 'Curriculum type', example: 'O_LEVEL' })
    @IsString()
    @IsOptional()
    curriculumType?: string;

    @ApiPropertyOptional({ description: 'Is grade active?' })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

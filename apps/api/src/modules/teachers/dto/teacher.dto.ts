// =============================================================================
// Teachers Module DTOs
// =============================================================================
import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsArray,
    IsEnum,
    IsDateString,
    ArrayMaxSize,
    Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubjectArea } from '@edu-lanka/shared-types';

export class CreateTeacherDto {
    @ApiProperty({ example: 'Nimal Jayawardena' })
    @IsString()
    @IsNotEmpty()
    fullName!: string;

    @ApiProperty({ example: 'nimal.j@school.edu.lk' })
    @IsString()
    @IsNotEmpty()
    email!: string;

    @ApiPropertyOptional({ example: '+94771234567' })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Employee number (auto-generated if omitted)', example: 'EMP/2026/001' })
    @IsString()
    @IsOptional()
    employeeNo?: string;

    @ApiPropertyOptional({ enum: SubjectArea, isArray: true })
    @IsArray()
    @IsEnum(SubjectArea, { each: true })
    @ArrayMaxSize(10)
    @IsOptional()
    subjectAreas?: SubjectArea[];

    @ApiPropertyOptional({ description: 'Hire date (ISO-8601)', example: '2026-01-15' })
    @IsDateString()
    @IsOptional()
    hireDate?: string;

    /** Temporary password for account creation */
    @ApiProperty({ minLength: 8 })
    @IsString()
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
        message: 'Password must contain uppercase, lowercase, and a number',
    })
    temporaryPassword!: string;
}

export class UpdateTeacherDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    fullName?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    avatarUrl?: string;

    @ApiPropertyOptional({ enum: SubjectArea, isArray: true })
    @IsArray()
    @IsEnum(SubjectArea, { each: true })
    @ArrayMaxSize(10)
    @IsOptional()
    subjectAreas?: SubjectArea[];

    @ApiPropertyOptional()
    @IsDateString()
    @IsOptional()
    hireDate?: string;
}

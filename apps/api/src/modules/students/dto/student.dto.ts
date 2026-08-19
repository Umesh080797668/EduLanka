// =============================================================================
// Students Module DTOs
// =============================================================================
import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsEnum,
    IsDateString,
    MaxLength,
    Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, ALStream, InstructionMedium } from '@edu-lanka/shared-types';

export class CreateStudentDto {
    @ApiProperty({ example: 'Kasun Perera' })
    @IsString()
    @IsNotEmpty()
    fullName!: string;

    @ApiPropertyOptional({ example: 'kasun.perera@school.edu.lk' })
    @IsString()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ example: '+94771234567' })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Admission number (auto-generated if omitted)', example: '2026/001' })
    @IsString()
    @IsOptional()
    @MaxLength(20)
    admissionNo?: string;

    @ApiPropertyOptional({ description: 'Date of birth (ISO-8601)', example: '2010-05-15' })
    @IsDateString()
    @IsOptional()
    dateOfBirth?: string;

    @ApiPropertyOptional({ enum: Gender })
    @IsEnum(Gender)
    @IsOptional()
    gender?: Gender;

    @ApiPropertyOptional({ description: 'Class UUID to enroll the student into' })
    @IsString()
    @IsOptional()
    classId?: string;

    @ApiPropertyOptional({ enum: ALStream, description: 'A/L stream for Grades 12-13' })
    @IsEnum(ALStream)
    @IsOptional()
    alStream?: ALStream;

    @ApiPropertyOptional({ enum: InstructionMedium })
    @IsEnum(InstructionMedium)
    @IsOptional()
    medium?: InstructionMedium;

    /** Temporary password for account creation */
    @ApiProperty({ minLength: 8, example: 'TempPass2026!' })
    @IsString()
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
        message: 'Password must contain uppercase, lowercase, and a number',
    })
    temporaryPassword!: string;
}

export class UpdateStudentDto {
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

    @ApiPropertyOptional()
    @IsDateString()
    @IsOptional()
    dateOfBirth?: string;

    @ApiPropertyOptional({ enum: Gender })
    @IsEnum(Gender)
    @IsOptional()
    gender?: Gender;

    @ApiPropertyOptional({ enum: ALStream })
    @IsEnum(ALStream)
    @IsOptional()
    alStream?: ALStream;

    @ApiPropertyOptional({ enum: InstructionMedium })
    @IsEnum(InstructionMedium)
    @IsOptional()
    medium?: InstructionMedium;
}

export class AssignClassDto {
    @ApiProperty({ description: 'Class UUID to assign the student to' })
    @IsString()
    @IsNotEmpty()
    classId!: string;
}

// =============================================================================
// Parents Module DTOs
// =============================================================================
import { IsNotEmpty, IsEnum, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParentRelationship } from '@edu-lanka/shared-types';

export class LinkStudentDto {
    @ApiProperty({ description: 'Student UUID to link to this parent' })
    @IsNotEmpty()
    studentId!: string;

    @ApiPropertyOptional({ enum: ParentRelationship, default: ParentRelationship.GUARDIAN })
    @IsEnum(ParentRelationship)
    @IsOptional()
    relationship?: ParentRelationship;
}

export class UnlinkStudentDto {
    @ApiProperty({ description: 'Student UUID to unlink from this parent' })
    @IsNotEmpty()
    studentId!: string;
}

export class CreateParentDto {
    @ApiProperty({ example: 'Nuwan Perera' })
    @IsString()
    @IsNotEmpty()
    fullName!: string;

    @ApiPropertyOptional({ example: 'nuwan@example.com' })
    @ValidateIf(o => !o.phoneNumber)
    @IsString()
    @IsNotEmpty()
    email?: string;

    @ApiPropertyOptional({ example: '+94771234567' })
    @ValidateIf(o => !o.email)
    @IsString()
    @IsNotEmpty()
    phoneNumber?: string;

    @ApiProperty({ minLength: 8 })
    @IsString()
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
        message: 'Password must contain uppercase, lowercase, and a number',
    })
    temporaryPassword!: string;
}

export class UpdateParentDto {
    @ApiPropertyOptional({ example: 'Nuwan Perera' })
    @IsString()
    @IsOptional()
    fullName?: string;

    @ApiPropertyOptional({ example: 'nuwan@example.com' })
    @IsString()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ example: '+94771234567' })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    avatarUrl?: string; // Standard for profile edits
}

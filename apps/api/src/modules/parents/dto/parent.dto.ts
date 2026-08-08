// =============================================================================
// Parents Module DTOs
// =============================================================================
import { IsNotEmpty, IsUUID, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParentRelationship } from '@edu-lanka/shared-types';

export class LinkStudentDto {
    @ApiProperty({ description: 'Student UUID to link to this parent' })
    @IsUUID()
    @IsNotEmpty()
    studentId!: string;

    @ApiPropertyOptional({ enum: ParentRelationship, default: ParentRelationship.GUARDIAN })
    @IsEnum(ParentRelationship)
    @IsOptional()
    relationship?: ParentRelationship;
}

export class UnlinkStudentDto {
    @ApiProperty({ description: 'Student UUID to unlink from this parent' })
    @IsUUID()
    @IsNotEmpty()
    studentId!: string;
}

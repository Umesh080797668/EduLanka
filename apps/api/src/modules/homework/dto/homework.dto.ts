import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsArray, IsIn, IsDateString } from 'class-validator';
import { IsUuidString } from '../../../common/decorators/is-uuid-string.decorator';

export class CreateHomeworkDto {
    @ApiProperty({ description: 'Class UUID to assign homework to' })
    @IsUuidString()
    classId: string;

    @ApiProperty({ description: 'Homework title' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ description: 'Homework instructions and task description' })
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({ description: 'Due date in ISO-8601 format' })
    @IsDateString()
    dueDate: string;

    @ApiPropertyOptional({ description: 'Attachment URLs or media links', type: [Object] })
    @IsOptional()
    @IsArray()
    attachments?: Array<Record<string, any>>;
}

export class SubmitHomeworkDto {
    @ApiPropertyOptional({ description: 'Student response text or solution' })
    @IsOptional()
    @IsString()
    content?: string;

    @ApiPropertyOptional({ description: 'Submitted attachment links', type: [Object] })
    @IsOptional()
    @IsArray()
    attachments?: Array<Record<string, any>>;

    @ApiPropertyOptional({ description: 'Client UUID for idempotency deduplication' })
    @IsOptional()
    @IsUuidString()
    clientUuid?: string;
}

export class GradeHomeworkDto {
    @ApiProperty({ description: 'Assigned grade (e.g. A, B+, 85/100)' })
    @IsString()
    @IsNotEmpty()
    grade: string;

    @ApiPropertyOptional({ description: 'Teacher feedback or notes' })
    @IsOptional()
    @IsString()
    feedback?: string;

    @ApiPropertyOptional({ enum: ['GRADED', 'RESUBMIT_REQUESTED'] })
    @IsOptional()
    @IsIn(['GRADED', 'RESUBMIT_REQUESTED'])
    status?: 'GRADED' | 'RESUBMIT_REQUESTED';
}

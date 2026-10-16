import { IsUUID, IsString, IsArray, ValidateNested, IsIn, Matches, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export class RecordAttendanceItemDto {
    @ApiProperty({ description: 'Student User UUID (references users.id)' })
    @IsUUID()
    studentId: string;

    @ApiProperty({ enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] })
    @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
    status: AttendanceStatus;
}

export class RecordAttendanceDto {
    @ApiProperty({ description: 'Class UUID' })
    @IsUUID()
    classId: string;

    @ApiProperty({ description: 'Date in YYYY-MM-DD format', example: '2026-10-15' })
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be formatted as YYYY-MM-DD' })
    date: string;

    @ApiProperty({ required: false, description: 'Class period number (1-12, defaults to 1)', example: 1, default: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    period?: number = 1;

    @ApiProperty({ type: [RecordAttendanceItemDto], description: 'Student roll call attendance entries' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RecordAttendanceItemDto)
    records: RecordAttendanceItemDto[];
}

export class GetAttendanceQueryDto {
    @ApiProperty({ description: 'Class UUID' })
    @IsUUID()
    classId: string;

    @ApiProperty({ required: false, description: 'Date in YYYY-MM-DD format (defaults to today)', example: '2026-10-15' })
    @IsOptional()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be formatted as YYYY-MM-DD' })
    date?: string;

    @ApiProperty({ required: false, description: 'Class period number (1-12, defaults to 1)', example: 1, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(12)
    period?: number = 1;
}

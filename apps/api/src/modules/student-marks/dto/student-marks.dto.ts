import { IsUUID, IsNumber, IsString, Min, Max, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMarkDto {
    @ApiProperty({ description: 'ID of the student' })
    @IsUUID()
    studentId: string;

    @ApiProperty({ description: 'Class ID the mark belongs to' })
    @IsUUID()
    classId: string;

    @ApiProperty({ description: 'Subject area or name' })
    @IsString()
    subject: string;

    @ApiProperty({ description: 'Term number (1 to 3)' })
    @IsInt()
    @Min(1)
    @Max(3)
    term: number;

    @ApiProperty({ description: 'Academic Year' })
    @IsInt()
    academicYear: number;

    @ApiProperty({ description: 'Marks obtained (0-100)' })
    @IsNumber()
    @Min(0)
    @Max(100)
    marks: number;
}

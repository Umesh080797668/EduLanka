import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, Max, IsInt, IsNotEmpty } from 'class-validator';

import { IsUuidString } from '../../../common/decorators/is-uuid-string.decorator';

export class CreateMarkDto {
    @ApiProperty({ description: 'ID of the student' })
    @IsNotEmpty()
    @IsUuidString()
    studentId: string;

    @ApiProperty({ description: 'Class ID the mark belongs to' })
    @IsNotEmpty()
    @IsUuidString()
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

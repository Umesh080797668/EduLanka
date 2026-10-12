import { IsString, IsNotEmpty, IsOptional, IsInt, IsIn, Min, Max } from 'class-validator';

export class CreatePaperDto {
    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsString()
    @IsNotEmpty()
    subject!: string;

    @IsInt()
    @Min(1)
    @Max(13)
    gradeLevel!: number;

    @IsInt()
    @Min(1990)
    @Max(2040)
    examYear!: number;

    @IsString()
    @IsIn(['OL', 'AL', 'GRADE5_SCHOLARSHIP', 'TERM_TEST'])
    examType!: 'OL' | 'AL' | 'GRADE5_SCHOLARSHIP' | 'TERM_TEST';

    @IsString()
    @IsIn(['sinhala', 'tamil', 'english'])
    medium!: 'sinhala' | 'tamil' | 'english';

    @IsString()
    @IsNotEmpty()
    paperCloudinaryId!: string;

    @IsString()
    @IsNotEmpty()
    paperUrl!: string;

    @IsString()
    @IsOptional()
    markingSchemeCloudinaryId?: string;

    @IsString()
    @IsOptional()
    markingSchemeUrl?: string;
}

export class AttachMarkingSchemeDto {
    @IsString()
    @IsNotEmpty()
    markingSchemeCloudinaryId!: string;

    @IsString()
    @IsNotEmpty()
    markingSchemeUrl!: string;
}

export class BulkUploadPapersDto {
    papers!: CreatePaperDto[];
}

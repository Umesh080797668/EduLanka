import { IsString, IsNotEmpty, IsOptional, IsInt, IsIn, Min, Max, IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize, Matches } from 'class-validator';
import { Type } from 'class-transformer';

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
    @Matches(/^https:\/\//i, { message: 'paperUrl must be a secure HTTPS URL' })
    paperUrl!: string;

    @IsString()
    @IsOptional()
    markingSchemeCloudinaryId?: string;

    @IsString()
    @IsOptional()
    @Matches(/^https:\/\//i, { message: 'markingSchemeUrl must be a secure HTTPS URL' })
    markingSchemeUrl?: string;
}

export class AttachMarkingSchemeDto {
    @IsString()
    @IsNotEmpty()
    markingSchemeCloudinaryId!: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^https:\/\//i, { message: 'markingSchemeUrl must be a secure HTTPS URL' })
    markingSchemeUrl!: string;
}

export class BulkUploadPapersDto {
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => CreatePaperDto)
    papers!: CreatePaperDto[];
}

import { IsString, IsNotEmpty, IsEnum, IsOptional, IsUUID, IsArray, IsBoolean } from 'class-validator';

export enum BlogScope {
    CLASS = 'CLASS',
    SCHOOL = 'SCHOOL',
    PLATFORM = 'PLATFORM',
}

export class CreateBlogDto {
    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsString()
    @IsNotEmpty()
    contentMarkdown!: string;

    @IsEnum(BlogScope)
    scope!: BlogScope;

    @IsOptional()
    @IsUUID()
    classId?: string;

    @IsOptional()
    @IsString()
    coverImageUrl?: string;

    @IsOptional()
    @IsArray()
    attachments?: Array<{
        name: string;
        url: string;
        fileSizeBytes?: number;
        mimeType?: string;
    }>;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @IsBoolean()
    isPublished?: boolean;

    @IsOptional()
    @IsBoolean()
    isPinned?: boolean;
}

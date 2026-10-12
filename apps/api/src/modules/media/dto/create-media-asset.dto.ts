import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';

export class CreateMediaAssetDto {
    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsNotEmpty()
    cloudinaryPublicId!: string;

    @IsString()
    @IsNotEmpty()
    cloudinarySecureUrl!: string;

    @IsString()
    @IsOptional()
    hlsUrl?: string;

    @IsString()
    @IsOptional()
    mp4Url?: string;

    @IsInt()
    @IsOptional()
    durationSeconds?: number;

    @IsInt()
    @Min(0)
    fileSizeBytes!: number;

    @IsString()
    @IsOptional()
    subject?: string;

    @IsInt()
    @Min(1)
    @Max(13)
    @IsOptional()
    gradeLevel?: number;

    @IsBoolean()
    @IsOptional()
    isDownloadable?: boolean;
}

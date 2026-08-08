import { IsString, IsNotEmpty, IsBoolean, IsArray, ValidateNested, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '@edu-lanka/shared-types';

export class CreateTutorialStepDto {
    @IsNumber()
    step_order: number;

    @IsString()
    @IsOptional()
    target_element?: string;

    @IsString()
    @IsNotEmpty()
    title_en: string;

    @IsString()
    @IsOptional()
    title_si?: string;

    @IsString()
    @IsOptional()
    title_ta?: string;

    @IsString()
    @IsNotEmpty()
    content_en: string;

    @IsString()
    @IsOptional()
    content_si?: string;

    @IsString()
    @IsOptional()
    content_ta?: string;

    @IsString()
    @IsOptional()
    media_url?: string;
}

export class CreateTutorialDto {
    @IsEnum(UserRole)
    role: UserRole;

    @IsString()
    @IsNotEmpty()
    screen_id: string;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateTutorialStepDto)
    steps: CreateTutorialStepDto[];
}

export class UpdateTutorialStatusDto {
    @IsString()
    @IsEnum(['COMPLETED', 'SKIPPED'])
    status: 'COMPLETED' | 'SKIPPED';
}

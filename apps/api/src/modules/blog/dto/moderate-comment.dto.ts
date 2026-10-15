import { IsBoolean, IsOptional } from 'class-validator';

export class ModerateCommentDto {
    @IsOptional()
    @IsBoolean()
    isHidden?: boolean;

    @IsOptional()
    @IsBoolean()
    isPinned?: boolean;
}

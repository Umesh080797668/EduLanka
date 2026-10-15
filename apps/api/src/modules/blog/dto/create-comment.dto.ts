import { IsString, IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(2000)
    content!: string;

    @IsOptional()
    @IsUUID()
    parentId?: string; // For threaded / nested comment replies
}

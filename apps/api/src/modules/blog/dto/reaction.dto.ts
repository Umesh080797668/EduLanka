import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum ReactionType {
    LIKE = 'LIKE',
    HELPFUL = 'HELPFUL',
    INSIGHTFUL = 'INSIGHTFUL',
    HEART = 'HEART',
}

export class ReactionDto {
    @IsEnum(ReactionType)
    reactionType!: ReactionType;

    @IsOptional()
    @IsUUID()
    commentId?: string; // If present, reacts to comment; otherwise reacts to blog post
}

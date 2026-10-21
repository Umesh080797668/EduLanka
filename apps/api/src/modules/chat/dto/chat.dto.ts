import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsUUID,
    IsString,
    IsNotEmpty,
    IsArray,
    IsBoolean,
    IsInt,
    IsOptional,
    Min,
    Max,
    MaxLength,
    ArrayNotEmpty,
    ArrayMaxSize,
} from 'class-validator';

export class StartDirectConversationDto {
    @ApiProperty({ description: 'Target user UUID to open or start conversation with' })
    @IsUUID()
    userId!: string;
}

export class CreateGroupConversationDto {
    @ApiProperty({ description: 'Group conversation name', example: 'Grade 11 Science Teachers' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name!: string;

    @ApiProperty({ description: 'Participant user UUIDs to enroll in group', isArray: true })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(100)
    @IsUUID('4', { each: true })
    memberIds!: string[];
}

export class SendMessageDto {
    @ApiProperty({ description: 'Target conversation UUID' })
    @IsUUID()
    conversationId!: string;

    @ApiProperty({ description: 'Message body text', maxLength: 4000 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(4000)
    content!: string;
}

export class SendConversationMessageDto {
    @ApiProperty({ description: 'Message body text', maxLength: 4000 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(4000)
    content!: string;
}

export class PinMessageDto {
    @ApiProperty({ description: 'Whether the message should be pinned' })
    @IsBoolean()
    isPinned!: boolean;

    @ApiPropertyOptional({ description: 'Optional message UUID override if not supplied in path parameter' })
    @IsOptional()
    @IsUUID()
    messageId?: string;
}

export class MuteParticipantDto {
    @ApiProperty({ description: 'Conversation UUID' })
    @IsUUID()
    conversationId!: string;

    @ApiProperty({ description: 'Participant user UUID to mute' })
    @IsUUID()
    participantUserId!: string;

    @ApiProperty({ description: 'Duration in minutes to mute the participant (1 to 43200)', example: 60 })
    @IsInt()
    @Min(1)
    @Max(43200)
    durationMinutes!: number;
}

export class RemoveParticipantDto {
    @ApiProperty({ description: 'Conversation UUID' })
    @IsUUID()
    conversationId!: string;

    @ApiProperty({ description: 'Participant user UUID to remove from conversation' })
    @IsUUID()
    participantUserId!: string;
}

export class MuteConversationDto {
    @ApiPropertyOptional({
        description: 'Duration in minutes to mute the conversation (0 to 43200, 0 un-mutes)',
        example: 60,
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(43200)
    durationMinutes?: number;
}

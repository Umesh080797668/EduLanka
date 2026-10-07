export enum SyncEventType {
    CREATED = 'CREATED',
    UPDATED = 'UPDATED',
    DELETED = 'DELETED',
}

export enum SyncEntityType {
    ATTENDANCE = 'attendance',
    HOMEWORK_SUBMISSION = 'homework_submission',
    CHAT_MESSAGE = 'chat_message',
    NOTICE = 'notice',
}

export interface SyncEvent<T = Record<string, unknown>> {
    id: string;
    tenant_id: string;
    entity_type: SyncEntityType | string;
    entity_id: string;
    event_type: SyncEventType;
    payload: T;
    client_uuid?: string | null;
    sequence: number;
    created_at: string;
}

export interface SyncPushItemDto {
    client_uuid: string;
    entity_type: SyncEntityType | string;
    entity_id: string;
    event_type: SyncEventType;
    payload: Record<string, unknown>;
}

export interface SyncPushBatchDto {
    events: SyncPushItemDto[];
}

export interface SyncPullResponse {
    events: SyncEvent[];
    last_sequence: number;
    has_more: boolean;
}

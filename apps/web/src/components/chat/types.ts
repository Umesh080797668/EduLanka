/**
 * Shapes returned by the chat API. Kept beside the components rather than in a
 * generated client because the endpoints are hand-written and small.
 */

export interface ConversationPreview {
    id: string;
    sender_id: string;
    content: string;
    created_at: string;
}

export interface Conversation {
    id: string;
    /** DIRECT threads have no stored name; the API fills in the counterpart. */
    name: string | null;
    type: 'CLASS' | 'DIRECT' | string;
    class_id: string | null;
    created_at: string;
    muted_until: string | null;
    /** Resolved server-side — reading the clock during render is not allowed. */
    is_muted: boolean;
    last_message: ConversationPreview | null;
    unread_count: number;
}

export interface Participant {
    id: string;
    user_id: string;
    /** Membership role within the thread, not the platform role. */
    role: 'MEMBER' | 'MODERATOR' | string;
    muted_until: string | null;
    joined_at: string;
    full_name: string | null;
    user_role: string | null;
    avatar_url: string | null;
    is_muted: boolean;
}

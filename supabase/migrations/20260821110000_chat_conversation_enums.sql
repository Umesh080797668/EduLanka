-- ============================================================================
-- Chat conversation/participant enum widening
--
-- Two values the application already relies on were never in the enums:
--
--   * `MODERATOR` — `ChatService.syncClassParticipants` marks assigned teachers
--     as moderators of their class group, and the identity back-fill in
--     20260821120000 does the same. Against the original
--     ('OWNER','MEMBER') enum every one of those writes fails with
--     22P02 invalid_text_representation, which silently left class groups
--     without members.
--   * `GROUP` — ad-hoc staff-created group threads, which are neither a class
--     roster ('CLASS') nor a two-person thread ('DIRECT').
--
-- This runs ahead of 20260821120000 so the back-fill there has the value
-- available. `ALTER TYPE ... ADD VALUE` may not be *used* in the transaction
-- that adds it, which is exactly why this is its own migration.
-- ============================================================================

ALTER TYPE conversation_participant_role ADD VALUE IF NOT EXISTS 'MODERATOR';

ALTER TYPE conversation_type ADD VALUE IF NOT EXISTS 'GROUP';

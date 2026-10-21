import { InquiriesBoard } from '@/components/inquiries/InquiriesBoard';

/** Platform-wide support inquiries. The board is shared with institution admins. */
export default function SystemAdminInquiriesPage() {
    return <InquiriesBoard role="SUPER_ADMIN" screenId="sys_inquiries" />;
}


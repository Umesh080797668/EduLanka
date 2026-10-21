import { InquiriesBoard } from '@/components/inquiries/InquiriesBoard';

/** Tenant-scoped support inquiries. The board is shared with the system admin. */
export default function InquiriesPage() {
    return <InquiriesBoard role="SCHOOL_ADMIN" screenId="admin_inquiries" />;
}


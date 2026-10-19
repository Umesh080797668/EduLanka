'use client';

import * as React from 'react';
import { Phone, MapPin, Users, ShieldAlert, AlertTriangle } from 'lucide-react';

import { apiClient } from '@/lib/api-client';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface EmergencyContact {
    id?: string;
    name: string;
    role: string;
    phone: string;
    isPrimary?: boolean;
    is_primary?: boolean | number;
}

interface Shelter {
    id?: string;
    name: string;
    address: string;
    capacity?: number;
}

interface DisasterPackData {
    tenantName?: string;
    disasterMode?: boolean;
    disasterReason?: string | null;
    expectedResumeDate?: string | null;
    emergencyContacts?: EmergencyContact[];
    shelters?: Shelter[];
    offlineCirculars?: Array<{ id: string; title: string; published_at?: string }>;
    learningResources?: Array<{ name: string; url: string; format: string }>;
}

interface DisasterPackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function DisasterPackModal({ isOpen, onClose }: DisasterPackModalProps) {
    const [data, setData] = React.useState<DisasterPackData | null>(null);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        queueMicrotask(() => {
            if (isMounted) setLoading(true);
        });

        apiClient
            .get<DisasterPackData>('/mobile/disaster-pack', { skipGlobalToast: true })
            .then((res) => {
                if (isMounted && res) {
                    setData(res);
                }
            })
            .catch(() => {
                // Fallback demo data if offline or network error
                if (isMounted) {
                    setData({
                        emergencyContacts: [
                            { name: 'Disaster Management Centre (DMC)', role: 'National Emergency Hotline', phone: '117', isPrimary: true },
                            { name: 'Police Emergency Response', role: 'National Hotline', phone: '119', isPrimary: true },
                            { name: 'Suwaseriya Ambulance Service', role: 'Medical Emergency Hotline', phone: '1990', isPrimary: true },
                        ],
                        shelters: [],
                    });
                }
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    const contacts = data?.emergencyContacts ?? [];
    const shelters = data?.shelters ?? [];

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            title="School Emergency & Disaster Pack"
            icon={<ShieldAlert className="size-5 text-danger-500" />}
            tone="danger"
            size="lg"
            footer={
                <div className="flex w-full items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                        Offline copies automatically sync to mobile devices via SQLCipher.
                    </p>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 text-sm">
                {/* Active alert if disaster mode is active */}
                {data?.disasterMode && (
                    <div className="flex items-start gap-3 rounded-card border border-danger-500/30 bg-danger-50 p-4 text-danger-900 dark:bg-danger-950/40 dark:text-danger-200">
                        <AlertTriangle className="size-5 shrink-0 text-danger-600 dark:text-danger-400 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="font-semibold text-sm">Disaster Emergency Closure Active</h4>
                            <p className="text-xs text-danger-800 dark:text-danger-300">
                                Reason: <span className="font-medium">{data.disasterReason || 'Emergency closure'}</span>
                                {data.expectedResumeDate && (
                                    <> &bull; Expected Resumption: <span className="font-medium">{data.expectedResumeDate}</span></>
                                )}
                            </p>
                        </div>
                    </div>
                )}

                {/* Emergency Contacts Section */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Phone className="size-4 text-danger-600 dark:text-danger-400" />
                        <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">
                            Emergency Hotlines & School Contacts
                        </h3>
                    </div>

                    {loading ? (
                        <div className="py-6 text-center text-xs text-muted-foreground animate-pulse">
                            Loading emergency contacts...
                        </div>
                    ) : contacts.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No emergency contacts registered yet.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {contacts.map((contact, idx) => {
                                const isPri = !!contact.isPrimary || Number(contact.is_primary) === 1;
                                return (
                                    <div
                                        key={contact.id || idx}
                                        className="flex items-center justify-between rounded-card border border-border/80 bg-surface p-3 shadow-xs hover:border-danger-400/50 transition-colors"
                                    >
                                        <div className="min-w-0 pr-2">
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-semibold text-xs text-foreground truncate">
                                                    {contact.name}
                                                </p>
                                                {isPri && (
                                                    <Badge tone="danger" size="sm">
                                                        Primary
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground truncate">{contact.role}</p>
                                        </div>
                                        <a
                                            href={`tel:${contact.phone}`}
                                            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-danger-600 hover:bg-danger-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors"
                                        >
                                            <Phone className="size-3" />
                                            {contact.phone}
                                        </a>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Evacuation Shelters Section */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <MapPin className="size-4 text-amber-600 dark:text-amber-400" />
                        <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">
                            Designated Evacuation Shelters
                        </h3>
                    </div>

                    {loading ? (
                        <div className="py-4 text-center text-xs text-muted-foreground animate-pulse">
                            Loading evacuation shelters...
                        </div>
                    ) : shelters.length === 0 ? (
                        <div className="rounded-card border border-border/60 bg-surface/50 p-3 text-xs text-muted-foreground">
                            No local evacuation shelters registered for this zone. In emergency situations, follow instructions from the Disaster Management Centre (Call 117).
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {shelters.map((shelter, idx) => (
                                <div
                                    key={shelter.id || idx}
                                    className="flex items-start justify-between rounded-card border border-border/80 bg-surface p-3 text-xs shadow-xs"
                                >
                                    <div>
                                        <h5 className="font-semibold text-foreground">{shelter.name}</h5>
                                        <p className="text-muted-foreground mt-0.5">{shelter.address}</p>
                                    </div>
                                    {shelter.capacity ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                                            <Users className="size-3" /> {shelter.capacity} capacity
                                        </span>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Instructions Box */}
                <div className="rounded-card border border-border/70 bg-muted/40 p-3.5 text-xs space-y-1.5">
                    <div className="font-semibold text-foreground">
                        Family Safety & Continuity Instructions:
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                        <li>Official closure and reopening decisions are broadcasted via SMS to parents&apos; registered phone numbers.</li>
                        <li>Coursework and past lessons previously downloaded on the EduLanka Mobile app remain accessible without internet.</li>
                        <li>Keep battery levels conserved and tune in to regional disaster broadcast advisories.</li>
                    </ul>
                </div>
            </div>
        </Dialog>
    );
}

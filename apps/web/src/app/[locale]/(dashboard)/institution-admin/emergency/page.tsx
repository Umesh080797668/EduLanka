'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    AlertTriangle,
    CheckCircle2,
    Edit2,
    Flame,
    Home,
    MapPin,
    Navigation,
    Phone,
    Plus,
    Radio,
    RefreshCw,
    ShieldAlert,
    Trash2,
    X,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { TutorialProvider } from '@/components/TutorialProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';

interface EmergencyContact {
    id: string;
    name: string;
    role: string;
    phone: string;
    is_primary?: boolean;
    display_order?: number;
    created_at?: string;
}

interface Shelter {
    id: string;
    name: string;
    address: string;
    capacity?: number;
    gps_lat?: number;
    gps_lng?: number;
    notes?: string;
    created_at?: string;
}

interface DisasterPackPreview {
    status: string;
    closure: {
        isActive: boolean;
        reason: string;
        expectedDuration: string;
    };
    contacts: Array<{ name: string; role: string; phone: string; is_primary?: boolean }>;
    shelters: Array<{ name: string; address: string; capacity?: number }>;
}

export default function EmergencyReadinessPage() {
    const [contacts, setContacts] = useState<EmergencyContact[]>([]);
    const [shelters, setShelters] = useState<Shelter[]>([]);
    const [packPreview, setPackPreview] = useState<DisasterPackPreview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'contacts' | 'shelters' | 'preview'>('contacts');

    // Contact Modal State
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
    const [contactName, setContactName] = useState('');
    const [contactRole, setContactRole] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactIsPrimary, setContactIsPrimary] = useState(false);
    const [contactDisplayOrder, setContactDisplayOrder] = useState(0);

    // Shelter Modal State
    const [isShelterModalOpen, setIsShelterModalOpen] = useState(false);
    const [editingShelter, setEditingShelter] = useState<Shelter | null>(null);
    const [shelterName, setShelterName] = useState('');
    const [shelterAddress, setShelterAddress] = useState('');
    const [shelterCapacity, setShelterCapacity] = useState<string>('');
    const [shelterGpsLat, setShelterGpsLat] = useState<string>('');
    const [shelterGpsLng, setShelterGpsLng] = useState<string>('');
    const [shelterNotes, setShelterNotes] = useState('');

    // Delete Confirmation State
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'contact' | 'shelter'; id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Broadcast Trigger State
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [broadcastReason, setBroadcastReason] = useState('MONSOON_FLOODING');

    const fetchData = async () => {
        try {
            const [contactsRes, sheltersRes, previewRes] = await Promise.all([
                apiClient.get<EmergencyContact[]>('/mobile/emergency-contacts').catch(() => []),
                apiClient.get<Shelter[]>('/mobile/shelters').catch(() => []),
                apiClient.get<DisasterPackPreview>('/mobile/disaster-pack').catch(() => null),
            ]);

            setContacts(Array.isArray(contactsRes) ? contactsRes : []);
            setShelters(Array.isArray(sheltersRes) ? sheltersRes : []);
            setPackPreview(previewRes);
        } catch {
            toast.error('Failed to load emergency readiness data');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchData();
    };

    // Open Contact Modal for Create or Edit
    const openContactModal = (contact?: EmergencyContact) => {
        if (contact) {
            setEditingContact(contact);
            setContactName(contact.name);
            setContactRole(contact.role);
            setContactPhone(contact.phone);
            setContactIsPrimary(contact.is_primary ?? false);
            setContactDisplayOrder(contact.display_order ?? 0);
        } else {
            setEditingContact(null);
            setContactName('');
            setContactRole('');
            setContactPhone('');
            setContactIsPrimary(false);
            setContactDisplayOrder(contacts.length);
        }
        setIsContactModalOpen(true);
    };

    const handleSaveContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contactName.trim() || !contactRole.trim() || !contactPhone.trim()) {
            toast.error('Please enter name, role, and phone number');
            return;
        }

        try {
            const payload = {
                id: editingContact?.id,
                name: contactName.trim(),
                role: contactRole.trim(),
                phone: contactPhone.trim(),
                isPrimary: contactIsPrimary,
                displayOrder: contactDisplayOrder,
            };

            await apiClient.post('/mobile/emergency-contacts', payload);
            toast.success(editingContact ? 'Emergency contact updated' : 'Emergency contact registered');
            setIsContactModalOpen(false);
            fetchData();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to save emergency contact');
        }
    };

    // Open Shelter Modal for Create or Edit
    const openShelterModal = (shelter?: Shelter) => {
        if (shelter) {
            setEditingShelter(shelter);
            setShelterName(shelter.name);
            setShelterAddress(shelter.address);
            setShelterCapacity(shelter.capacity ? String(shelter.capacity) : '');
            setShelterGpsLat(shelter.gps_lat ? String(shelter.gps_lat) : '');
            setShelterGpsLng(shelter.gps_lng ? String(shelter.gps_lng) : '');
            setShelterNotes(shelter.notes || '');
        } else {
            setEditingShelter(null);
            setShelterName('');
            setShelterAddress('');
            setShelterCapacity('');
            setShelterGpsLat('');
            setShelterGpsLng('');
            setShelterNotes('');
        }
        setIsShelterModalOpen(true);
    };

    const handleSaveShelter = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shelterName.trim() || !shelterAddress.trim()) {
            toast.error('Please enter shelter name and address');
            return;
        }

        try {
            const payload = {
                id: editingShelter?.id,
                name: shelterName.trim(),
                address: shelterAddress.trim(),
                capacity: shelterCapacity ? parseInt(shelterCapacity, 10) : undefined,
                gpsLat: shelterGpsLat ? parseFloat(shelterGpsLat) : undefined,
                gpsLng: shelterGpsLng ? parseFloat(shelterGpsLng) : undefined,
                notes: shelterNotes.trim() || undefined,
            };

            await apiClient.post('/mobile/shelters', payload);
            toast.success(editingShelter ? 'Evacuation shelter updated' : 'Evacuation shelter registered');
            setIsShelterModalOpen(false);
            fetchData();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to save evacuation shelter');
        }
    };

    // Handle Deletion
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            if (deleteTarget.type === 'contact') {
                await apiClient.delete(`/mobile/emergency-contacts/${deleteTarget.id}`);
                toast.success('Emergency contact removed');
            } else {
                await apiClient.delete(`/mobile/shelters/${deleteTarget.id}`);
                toast.success('Evacuation shelter removed');
            }
            setDeleteTarget(null);
            fetchData();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to remove entry');
        } finally {
            setIsDeleting(false);
        }
    };

    // Handle Test Push Broadcast
    const handleTriggerTestBroadcast = async () => {
        setIsBroadcasting(true);
        try {
            await apiClient.post('/mobile/test-disaster-push', {
                reason: broadcastReason,
                expectedDuration: '3_DAYS',
            });
            toast.success('Emergency Disaster broadcast dispatched to mobile devices & emergency SMS contacts');
            fetchData();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to dispatch disaster push broadcast');
        } finally {
            setIsBroadcasting(false);
        }
    };

    const isEmptyState = contacts.length === 0 && shelters.length === 0;

    return (
        <TutorialProvider role="SCHOOL_ADMIN" screenId="disaster">
            <div className="mx-auto max-w-6xl space-y-6">
                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <ShieldAlert className="size-8 text-brand-600 dark:text-brand-400" />
                            <h1 className="text-display-sm text-neutral-900 dark:text-neutral-50">
                                Emergency & Disaster Readiness
                            </h1>
                        </div>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                            Configure school emergency contacts and local evacuation shelters bundled into students&apos; offline disaster packs.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="gap-2"
                        >
                            <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* ── Empty State Onboarding Warning ──────────────────────── */}
                {isEmptyState && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-card border-2 border-danger-300 bg-danger-50/70 p-5 text-danger-950 shadow-sm dark:border-danger-700/60 dark:bg-danger-950/30 dark:text-danger-100"
                    >
                        <div className="flex items-start gap-3.5">
                            <div className="rounded-full bg-danger-200/80 p-2 text-danger-800 dark:bg-danger-900/60 dark:text-danger-200">
                                <AlertTriangle className="size-6" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-base font-semibold">
                                    Urgent: Offline Disaster Pack ships empty without data!
                                </h3>
                                <p className="text-xs leading-relaxed text-danger-800/90 dark:text-danger-300/90">
                                    Your institution currently has 0 registered emergency contacts and 0 evacuation shelters.
                                    When disaster mode is triggered, students and parents offline will receive an empty pack without
                                    verified rescue lines or physical evacuation locations. Please configure both immediately.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── Navigation Tabs ──────────────────────────────────────── */}
                <div className="flex border-b border-neutral-200 dark:border-neutral-800">
                    <button
                        type="button"
                        onClick={() => setActiveTab('contacts')}
                        className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                            activeTab === 'contacts'
                                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                        }`}
                    >
                        <Phone className="size-4" />
                        Emergency Contacts ({contacts.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('shelters')}
                        className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                            activeTab === 'shelters'
                                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                        }`}
                    >
                        <Home className="size-4" />
                        Evacuation Shelters ({shelters.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('preview')}
                        className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                            activeTab === 'preview'
                                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                        }`}
                    >
                        <Radio className="size-4" />
                        Offline Pack Preview & Broadcast
                    </button>
                </div>

                {/* ── Tab 1: Emergency Contacts ────────────────────────────── */}
                {activeTab === 'contacts' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                                    School Designated Contacts
                                </h2>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    Official contact personnel dispatched via Twilio emergency SMS and offline mobile cards.
                                </p>
                            </div>
                            <Button
                                id="add-emergency-contact-btn"
                                onClick={() => openContactModal()}
                                className="gap-2"
                            >
                                <Plus className="size-4" />
                                Add Contact
                            </Button>
                        </div>

                        {contacts.length === 0 ? (
                            <Card className="p-8 text-center">
                                <Phone className="mx-auto size-10 text-neutral-400" />
                                <h3 className="mt-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                    No emergency contacts registered
                                </h3>
                                <p className="mt-1 text-xs text-neutral-500">
                                    Add principal, first aid officer, or security hotline numbers.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openContactModal()}
                                    className="mt-4 gap-2"
                                >
                                    <Plus className="size-4" />
                                    Register First Contact
                                </Button>
                            </Card>
                        ) : (
                            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                                {contacts.map((c) => (
                                    <Card key={c.id} className="relative overflow-hidden p-4 shadow-sm">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                                                        {c.name}
                                                    </h3>
                                                    {c.is_primary && (
                                                        <Badge tone="primary" size="sm">
                                                            Primary
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs font-medium text-brand-600 dark:text-brand-400">
                                                    {c.role}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => openContactModal(c)}
                                                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
                                                    title="Edit contact"
                                                >
                                                    <Edit2 className="size-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteTarget({ type: 'contact', id: c.id, name: c.name })}
                                                    className="rounded p-1 text-neutral-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-950"
                                                    title="Delete contact"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
                                            <Phone className="size-3.5 text-neutral-400" />
                                            <a href={`tel:${c.phone}`} className="font-mono hover:underline">
                                                {c.phone}
                                            </a>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Tab 2: Evacuation Shelters ────────────────────────────── */}
                {activeTab === 'shelters' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                                    Emergency Evacuation Shelters
                                </h2>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    Official community shelters, elevated community temples, and high-ground refugee centers.
                                </p>
                            </div>
                            <Button
                                id="add-shelter-btn"
                                onClick={() => openShelterModal()}
                                className="gap-2"
                            >
                                <Plus className="size-4" />
                                Add Shelter
                            </Button>
                        </div>

                        {shelters.length === 0 ? (
                            <Card className="p-8 text-center">
                                <Home className="mx-auto size-10 text-neutral-400" />
                                <h3 className="mt-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                    No evacuation shelters registered
                                </h3>
                                <p className="mt-1 text-xs text-neutral-500">
                                    Register safe high-ground schools, religious centers, or community halls.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openShelterModal()}
                                    className="mt-4 gap-2"
                                >
                                    <Plus className="size-4" />
                                    Register First Shelter
                                </Button>
                            </Card>
                        ) : (
                            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                                {shelters.map((s) => (
                                    <Card key={s.id} className="relative overflow-hidden p-4 shadow-sm">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                                                    {s.name}
                                                </h3>
                                                {s.capacity && (
                                                    <Badge variant="outline" size="sm">
                                                        Capacity: {s.capacity}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => openShelterModal(s)}
                                                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
                                                    title="Edit shelter"
                                                >
                                                    <Edit2 className="size-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteTarget({ type: 'shelter', id: s.id, name: s.name })}
                                                    className="rounded p-1 text-neutral-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-950"
                                                    title="Delete shelter"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                                            <MapPin className="size-3.5 shrink-0 text-neutral-400 mt-0.5" />
                                            <span>{s.address}</span>
                                        </div>

                                        {(s.gps_lat || s.gps_lng) && (
                                            <div className="mt-2 flex items-center gap-2 text-xs font-mono text-neutral-500">
                                                <Navigation className="size-3 text-neutral-400" />
                                                <span>
                                                    GPS: {s.gps_lat?.toFixed(5)}, {s.gps_lng?.toFixed(5)}
                                                </span>
                                            </div>
                                        )}

                                        {s.notes && (
                                            <p className="mt-2 text-xs italic text-neutral-500 dark:text-neutral-400 border-t border-neutral-100 pt-2 dark:border-neutral-800">
                                                {s.notes}
                                            </p>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Tab 3: Disaster Pack Preview & Broadcast ─────────────── */}
                {activeTab === 'preview' && (
                    <div className="space-y-6">
                        {/* Broadcast Dispatcher */}
                        <Card className="border-danger-200 bg-gradient-to-r from-danger-500/10 via-brand-500/5 to-transparent p-5 dark:border-danger-900/50">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Radio className="size-5 text-danger-600 dark:text-danger-400" />
                                        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            Emergency Disaster Mode Broadcast
                                        </h3>
                                    </div>
                                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                                        Fires high-priority BullMQ FCM push notifications and queues emergency Twilio SMS messages
                                        to registered guardians, pre-caching offline learning packs.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        value={broadcastReason}
                                        onChange={(e) => setBroadcastReason(e.target.value)}
                                        className="rounded-input border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                                    >
                                        <option value="MONSOON_FLOODING">Monsoon Flooding</option>
                                        <option value="CYCLONE_WARNING">Cyclone Warning</option>
                                        <option value="LANDSLIDE_RISK">Landslide Threat</option>
                                        <option value="CIVIL_EMERGENCY">Civil Emergency</option>
                                    </select>
                                    <Button
                                        id="broadcast-disaster-btn"
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleTriggerTestBroadcast}
                                        disabled={isBroadcasting}
                                        className="gap-2"
                                    >
                                        <Flame className={`size-4 ${isBroadcasting ? 'animate-pulse' : ''}`} />
                                        {isBroadcasting ? 'Broadcasting...' : 'Trigger Disaster Broadcast'}
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* Live Pack Preview */}
                        <Card className="p-5">
                            <CardHeader className="px-0 pt-0">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <CheckCircle2 className="size-4 text-emerald-600" />
                                    Live Mobile Disaster Pack Preview
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    This bundle is cryptographically sealed and automatically synced to all registered student and parent mobile devices.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-0 pb-0 space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-card border border-neutral-200 bg-neutral-50/50 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/50">
                                        <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                                            Included Emergency Contacts ({packPreview?.contacts.length ?? 0})
                                        </h4>
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                            {packPreview?.contacts.map((c, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                                                    <div>
                                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">{c.name}</span>
                                                        <span className="text-neutral-400 text-[11px] ml-1.5">({c.role})</span>
                                                    </div>
                                                    <span className="font-mono text-brand-600 dark:text-brand-400 font-semibold">{c.phone}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="rounded-card border border-neutral-200 bg-neutral-50/50 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/50">
                                        <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                                            Designated Evacuation Shelters ({packPreview?.shelters.length ?? 0})
                                        </h4>
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                            {packPreview?.shelters.length === 0 ? (
                                                <p className="text-xs text-neutral-400 italic">No shelters currently in pack.</p>
                                            ) : (
                                                packPreview?.shelters.map((s, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[200px]">{s.name}</span>
                                                        {s.capacity && <Badge size="sm" variant="outline">Cap: {s.capacity}</Badge>}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ── Contact Create/Edit Modal ────────────────────────────── */}
                {isContactModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-md rounded-card bg-white p-6 shadow-xl dark:bg-neutral-900">
                            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                                <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                                    {editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setIsContactModalOpen(false)}
                                    className="text-neutral-400 hover:text-neutral-600"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveContact} className="mt-4 space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                        Contact Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={contactName}
                                        onChange={(e) => setContactName(e.target.value)}
                                        placeholder="e.g. Mr. K. Perera (Principal)"
                                        className="mt-1 w-full rounded-input border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                        Role / Designation *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={contactRole}
                                        onChange={(e) => setContactRole(e.target.value)}
                                        placeholder="e.g. First Aid Officer, Emergency Response Lead"
                                        className="mt-1 w-full rounded-input border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                        Emergency Phone Number *
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        value={contactPhone}
                                        onChange={(e) => setContactPhone(e.target.value)}
                                        placeholder="e.g. +94771234567 or 0112345678"
                                        className="mt-1 w-full rounded-input border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="contactIsPrimary"
                                        checked={contactIsPrimary}
                                        onChange={(e) => setContactIsPrimary(e.target.checked)}
                                        className="size-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                                    />
                                    <label htmlFor="contactIsPrimary" className="text-xs text-neutral-700 dark:text-neutral-300">
                                        Designate as Primary School Contact
                                    </label>
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsContactModalOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit">
                                        Save Contact
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Shelter Create/Edit Modal ────────────────────────────── */}
                {isShelterModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-md rounded-card bg-white p-6 shadow-xl dark:bg-neutral-900">
                            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                                <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                                    {editingShelter ? 'Edit Evacuation Shelter' : 'Add Evacuation Shelter'}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setIsShelterModalOpen(false)}
                                    className="text-neutral-400 hover:text-neutral-600"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveShelter} className="mt-4 space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                        Shelter Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={shelterName}
                                        onChange={(e) => setShelterName(e.target.value)}
                                        placeholder="e.g. Sri Sudharshana Temple Hall (Elevated)"
                                        className="mt-1 w-full rounded-input border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                        Physical Address & Location *
                                    </label>
                                    <textarea
                                        required
                                        rows={2}
                                        value={shelterAddress}
                                        onChange={(e) => setShelterAddress(e.target.value)}
                                        placeholder="e.g. Temple Road, Kaduwela, Colombo"
                                        className="mt-1 w-full rounded-input border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                            Capacity
                                        </label>
                                        <input
                                            type="number"
                                            value={shelterCapacity}
                                            onChange={(e) => setShelterCapacity(e.target.value)}
                                            placeholder="500"
                                            className="mt-1 w-full rounded-input border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                            GPS Lat
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={shelterGpsLat}
                                            onChange={(e) => setShelterGpsLat(e.target.value)}
                                            placeholder="6.9271"
                                            className="mt-1 w-full rounded-input border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                            GPS Lng
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={shelterGpsLng}
                                            onChange={(e) => setShelterGpsLng(e.target.value)}
                                            placeholder="79.8612"
                                            className="mt-1 w-full rounded-input border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                        Notes / Facilities Available
                                    </label>
                                    <input
                                        type="text"
                                        value={shelterNotes}
                                        onChange={(e) => setShelterNotes(e.target.value)}
                                        placeholder="Generator power, first aid clinic, potable water tank"
                                        className="mt-1 w-full rounded-input border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsShelterModalOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit">
                                        Save Shelter
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Delete Confirmation Dialog ───────────────────────────── */}
                <ConfirmDialog
                    open={Boolean(deleteTarget)}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={handleConfirmDelete}
                    title={`Delete ${deleteTarget?.type === 'contact' ? 'Emergency Contact' : 'Evacuation Shelter'}`}
                    description={`Are you sure you want to remove "${deleteTarget?.name}"? A tombstone will be recorded and synced to all devices.`}
                    confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
                    cancelLabel="Cancel"
                    tone="danger"
                    loading={isDeleting}
                />
            </div>
        </TutorialProvider>
    );
}

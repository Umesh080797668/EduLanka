import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function useRealtimeTelemetry() {
    const [activeUsers, setActiveUsers] = useState<number>(0);
    const supabase = createSupabaseBrowserClient();

    useEffect(() => {
        const channel = supabase.channel('system_telemetry', {
            config: { presence: { key: 'admin_dashboard' } }
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const presenceState = channel.presenceState();
                const totalConnections = Object.keys(presenceState).length;
                setActiveUsers(totalConnections);
            })
            .on('presence', { event: 'join' }, ({ newPresences }: { newPresences: any[] }) => {
                console.log('Joined Telemetry Node', newPresences);
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: any[] }) => {
                console.log('Left Telemetry Node', leftPresences);
            })
            .subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ online_at: new Date().toISOString() });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    return { activeUsers };
}

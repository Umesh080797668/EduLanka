import { Injectable, Logger, Optional } from '@nestjs/common';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsGateway } from './notifications.gateway';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushDispatchResult {
  dispatchedCount: number;
  failureCount: number;
  deadTokensCount: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseInitialized = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    @Optional() private readonly notificationsGateway?: NotificationsGateway
  ) {
    this.initFirebase();
  }

  /**
   * Initialize Firebase Admin SDK using service account credentials.
   */
  private initFirebase(): void {
    if (getApps().length > 0) {
      this.firebaseInitialized = true;
      return;
    }

    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (saJson) {
      try {
        let raw = saJson.trim();
        if (!raw.startsWith('{') && !raw.startsWith('[')) {
          try {
            raw = Buffer.from(raw, 'base64').toString('utf8');
          } catch (decodeErr) {
            this.logger.debug(
              `Could not base64-decode service account string: ${(decodeErr as Error).message}`
            );
          }
        }
        const sa = JSON.parse(raw);
        if (sa.private_key && typeof sa.private_key === 'string') {
          sa.private_key = sa.private_key.replace(/\\n/g, '\n');
        }
        initializeApp({
          credential: cert(sa),
        });
        this.firebaseInitialized = true;
        this.logger.log('Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT credentials');
      } catch (e: any) {
        this.logger.error(`Failed initializing Firebase with service account JSON: ${e.message}`);
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        initializeApp();
        this.firebaseInitialized = true;
        this.logger.log('Firebase Admin initialized via GOOGLE_APPLICATION_CREDENTIALS');
      } catch (e: any) {
        this.logger.error(
          `Failed initializing Firebase via GOOGLE_APPLICATION_CREDENTIALS: ${e.message}`
        );
      }
    } else {
      this.logger.warn(
        'No Firebase Admin credentials provided. FCM push will run in local simulation mode.'
      );
    }
  }

  /**
   * Send push notification directly to specified target FCM registration tokens.
   */
  async sendPushToTokens(
    tokens: string[],
    payload: PushNotificationPayload,
    tenantId?: string
  ): Promise<PushDispatchResult> {
    const uniqueTokens = [...new Set(tokens.filter((t) => t && t.trim().length > 0))];
    if (uniqueTokens.length === 0) {
      return { dispatchedCount: 0, failureCount: 0, deadTokensCount: 0 };
    }

    // Batch tokens in chunks of 500 (FCM HTTP v1 multicast maximum)
    const BATCH_SIZE = 500;
    const batches: string[][] = [];
    for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
      batches.push(uniqueTokens.slice(i, i + BATCH_SIZE));
    }

    const deadTokens: string[] = [];
    let dispatchedCount = 0;
    let failureCount = 0;

    for (const batch of batches) {
      if (this.firebaseInitialized && getApps().length > 0) {
        try {
          const messaging = getMessaging();
          const response = await messaging.sendEachForMulticast({
            tokens: batch,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: payload.data,
            android: {
              priority: 'high',
            },
            apns: {
              headers: {
                'apns-push-type': 'alert',
                'apns-priority': '10',
              },
              payload: {
                aps: {
                  alert: {
                    title: payload.title,
                    body: payload.body,
                  },
                  sound: 'default',
                  contentAvailable: true,
                },
              },
            },
          });

          dispatchedCount += response.successCount;
          failureCount += response.failureCount;

          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errorCode = resp.error?.code;
              if (
                errorCode === 'messaging/registration-token-not-registered' ||
                errorCode === 'messaging/invalid-registration-token'
              ) {
                deadTokens.push(batch[idx]);
              }
            }
          });
        } catch (err: any) {
          this.logger.error(`FCM batch multicast failed: ${err.message}`);
          failureCount += batch.length;
        }
      } else {
        // In test or local dev simulation
        this.logger.warn(
          `[Simulation] Dispatched FCM push to ${batch.length} tokens for tenant ${tenantId || 'global'}`
        );
        dispatchedCount += batch.length;
      }
    }

    // Clean up dead tokens in device_tokens registry
    if (deadTokens.length > 0) {
      await this.cleanUpDeadTokens(deadTokens, tenantId);
    }

    return {
      dispatchedCount,
      failureCount,
      deadTokensCount: deadTokens.length,
    };
  }

  /**
   * Send push notification to all active registered devices of given user IDs within a tenant.
   */
  async sendPushToUsers(
    tenantId: string,
    userIds: string[],
    payload: PushNotificationPayload
  ): Promise<PushDispatchResult> {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueUserIds.length === 0) {
      return { dispatchedCount: 0, failureCount: 0, deadTokensCount: 0 };
    }

    const client = this.supabaseService.adminClient;
    const { data: rows, error } = await client
      .from('device_tokens')
      .select('token')
      .eq('tenant_id', tenantId)
      .in('user_id', uniqueUserIds)
      .eq('is_active', true);

    if (error) {
      this.logger.error(`Failed to query device tokens for tenant ${tenantId}: ${error.message}`);
      return { dispatchedCount: 0, failureCount: 0, deadTokensCount: 0 };
    }

    const tokens = (rows ?? []).map((r: any) => r.token).filter(Boolean);
    return this.sendPushToTokens(tokens, payload, tenantId);
  }

  /**
   * Register or refresh a mobile device FCM token in the push registry.
   */
  async registerDeviceToken(
    tenantId: string,
    userId: string,
    token: string,
    platform: 'android' | 'ios' | 'web',
    deviceModel?: string
  ): Promise<boolean> {
    const client = this.supabaseService.adminClient;
    const { error } = await client.from('device_tokens').upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        token,
        platform,
        device_model: deviceModel || null,
        is_active: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );

    if (error) {
      this.logger.error(`Failed to register device token for user ${userId}: ${error.message}`);
      return false;
    }

    return true;
  }

  /**
   * Deactivate dead or invalid FCM tokens.
   */
  private async cleanUpDeadTokens(tokens: string[], tenantId?: string): Promise<void> {
    try {
      const client = this.supabaseService.adminClient;
      let query = client
        .from('device_tokens')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('token', tokens);

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { error } = await query;
      if (error) {
        this.logger.error(`Failed to deactivate dead device tokens: ${error.message}`);
      } else {
        this.logger.log(`Deactivated ${tokens.length} dead device tokens from registry`);
      }
    } catch (err: any) {
      this.logger.warn(`Error during dead token cleanup: ${err.message}`);
    }
  }

  /**
   * Programmatic broadcast to connected web sockets via NotificationsGateway.
   */
  broadcastSystemNotification(payload: any, tenantId?: string): void {
    this.notificationsGateway?.sendNotification(payload, tenantId);
  }
}

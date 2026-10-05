import { Controller, Post, Get, Req, Res, Logger, HttpStatus, UseGuards, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import * as twilio from 'twilio';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AppConfiguration } from '../../config/configuration';
import { SupabaseService } from '../supabase/supabase.service';


const STATUS_RANK: Record<string, number> = {
    QUEUED: 1,
    SENT: 2,
    DELIVERED: 3,
    FAILED: 3,
};

@Controller('sms')
export class SmsController {
    private readonly logger = new Logger(SmsController.name);

    constructor(
        private readonly configService: ConfigService<AppConfiguration>,
        private readonly supabaseService: SupabaseService
    ) { }

    @Get('quotas')
    @UseGuards(JwtAuthGuard)
    async getSystemSmsQuotas(@CurrentUser() user: any) {
        if (user.role !== 'SUPER_ADMIN') {
            throw new ForbiddenException('Only Central Admistrators can access Global Twilio Billing limits');
        }

        const { data, error } = await this.supabaseService.adminClient
            .from('tenant_sms_quotas')
            .select('*')
            .order('overage_count', { ascending: false });

        if (error) {
            this.logger.error(`SMS View Read Fail: ${error.message}`);
            throw new InternalServerErrorException('Failed fetching Billing matrices.');
        }

        return data;
    }

    @Post('webhook')
    @ApiExcludeEndpoint()
    async handleTwilioWebhook(@Req() req: any, @Res() res: any) {
        const authToken = this.configService.get('twilio.authToken', { infer: true }) || '';
        const twilioSignature = req.headers['x-twilio-signature'] as string;

        const targetUrl = this.configService.get('twilio.webhookUrl', { infer: true })
            || `${this.configService.get('app.publicUrl', { infer: true })}/api/v1/sms/webhook`;

        // Safety Fallback handling missing body parses in fastify natively
        const params = req.body || {};

        if (authToken) {
            if (!twilioSignature) {
                this.logger.warn('Twilio webhook rejected: missing x-twilio-signature header');
                return res.status(HttpStatus.FORBIDDEN).send('Missing X-Twilio-Signature header');
            }

            const isValid = twilio.validateRequest(authToken, twilioSignature, targetUrl, params);
            if (!isValid) {
                this.logger.warn('Invalid Twilio Signature intercepted from Gateway Webhook!');
                return res.status(HttpStatus.FORBIDDEN).send('Invalid Signature');
            }
        } else {
            if (process.env.NODE_ENV === 'production') {
                this.logger.error('Twilio webhook rejected: TWILIO_AUTH_TOKEN is not configured in production');
                return res.status(HttpStatus.SERVICE_UNAVAILABLE).send('Webhook unconfigured');
            }
            this.logger.warn('Skipping Twilio Webhook Signature Validation (missing DEV config)');
        }

        const sid = params.SmsSid || params.MessageSid;
        const status = params.MessageStatus;
        const errorCode = params.ErrorCode;

        if (sid && status) {
            const mapTwilioStatus = (s: string) => {
                switch (s.toLowerCase()) {
                    case 'sent': return 'SENT';
                    case 'delivered': return 'DELIVERED';
                    case 'failed':
                    case 'undelivered':
                        return 'FAILED';
                    default: return null;
                }
            };

            const dbStatus = mapTwilioStatus(status);
            if (dbStatus) {
                const db = this.supabaseService.adminClient;

                // 1. Fetch current sms_logs entry to prevent out-of-order transitions
                let logEntry: any = null;
                try {
                    const lookup = await db.from('sms_logs')
                        .select('id, status, disaster_event_id')
                        .eq('twilio_sid', sid)
                        .maybeSingle();
                    logEntry = lookup?.data;
                } catch (e: any) {
                    this.logger.debug(`Could not query existing sms_logs: ${e?.message}`);
                }

                if (logEntry) {
                    const currentRank = STATUS_RANK[logEntry.status] || 0;
                    const newRank = STATUS_RANK[dbStatus] || 0;

                    // Prevent late 'SENT' from overwriting 'DELIVERED' or 'FAILED'
                    if (newRank < currentRank) {
                        this.logger.warn(`Ignoring out-of-order Twilio callback for ${sid}: current ${logEntry.status}, incoming ${dbStatus}`);
                        return res.status(HttpStatus.OK).send('<Response></Response>');
                    }

                    const isNewTerminalStatus = newRank === 3 && currentRank < 3;

                    await db.from('sms_logs')
                        .update({ status: dbStatus, error_code: errorCode || null, updated_at: new Date().toISOString() })
                        .eq('id', logEntry.id);

                    this.logger.log(`Webhook updated TWILIO_SID: [${sid}] => ${dbStatus}`);

                    // 2. Link delivery stats to disaster_events via atomic RPC to prevent lost updates
                    if (isNewTerminalStatus && logEntry.disaster_event_id) {
                        const { error: rpcErr } = await db.rpc('increment_disaster_sms_count', {
                            p_event_id: logEntry.disaster_event_id,
                            p_status: dbStatus,
                        });
                        if (rpcErr) {
                            this.logger.error(`Failed to increment disaster sms count: ${rpcErr.message}`);
                        }
                    }
                } else {
                    // Direct update fallback (e.g. unit tests or early webhook)
                    await db.from('sms_logs')
                        .update({ status: dbStatus, error_code: errorCode || null })
                        .eq('twilio_sid', sid);
                }
            }
        }

        return res.status(HttpStatus.OK).send('<Response></Response>');
    }
}

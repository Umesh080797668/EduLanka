import { Controller, Post, Get, Req, Res, Logger, HttpStatus, UseGuards, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppConfiguration } from '../../config/configuration';
import { SupabaseService } from '../supabase/supabase.service';
import * as twilio from 'twilio';

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

        const targetUrl = `${this.configService.get('app.publicUrl', { infer: true })}/api/v1/sms/webhook`;

        // Safety Fallback handling missing body parses in fastify natively
        const params = req.body || {};

        if (authToken && twilioSignature) {
            const isValid = twilio.validateRequest(authToken, twilioSignature, targetUrl, params);
            if (!isValid) {
                this.logger.warn('Invalid Twilio Signature intercepted from Gateway Webhook!');
                return res.status(HttpStatus.FORBIDDEN).send('Invalid Signature');
            }
        } else {
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
                await db.from('sms_logs')
                    .update({ status: dbStatus, error_code: errorCode || null })
                    .eq('twilio_sid', sid);

                this.logger.log(`Webhook natively updated TWILIO_SID: [${sid}] => ${dbStatus}`);
            }
        }

        return res.status(HttpStatus.OK).send('<Response></Response>');
    }
}

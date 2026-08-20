import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../config/configuration';
import { Twilio } from 'twilio';

@Injectable()
export class SmsService {
    private readonly logger = new Logger(SmsService.name);
    private readonly client: Twilio | null = null;
    private readonly fromNumber: string | undefined;

    constructor(private readonly configService: ConfigService<AppConfiguration>) {
        const accountSid = this.configService.get('twilio.accountSid', { infer: true });
        const authToken = this.configService.get('twilio.authToken', { infer: true });
        this.fromNumber = this.configService.get('twilio.fromNumber', { infer: true });

        if (accountSid && authToken && this.fromNumber) {
            this.client = new Twilio(accountSid, authToken);
            this.logger.log('Twilio client successfully initialized.');
        } else {
            this.logger.warn('Twilio credentials missing in environment. SMS functionality will be simulated.');
        }
    }

    async sendSms(to: string, message: string) {
        if (!this.client) {
            this.logger.log(`[SIMULATED SMS] TO: ${to} - MESSAGE: ${message}`);
            return { success: true, simulated: true };
        }

        try {
            const result = await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to,
            });
            this.logger.log(`SMS dispatched via Twilio to ${to}. SID: ${result.sid}`);
            return { success: true, sid: result.sid };
        } catch (error: any) {
            this.logger.error(`Failed to send SMS to ${to}: ${error.message}`);
            throw error;
        }
    }
}

import { BullModule } from '@nestjs/bullmq';
import { Module, Global } from '@nestjs/common';

import { SmsController } from './sms.controller';
import { SmsProcessor } from './sms.processor';
import { SmsService } from './sms.service';

@Global()
@Module({
    imports: [
        BullModule.registerQueue({
            name: 'sms-gateway',
        }),
    ],
    controllers: [SmsController],
    providers: [SmsService, SmsProcessor],
    exports: [SmsService],
})
export class SmsModule { }

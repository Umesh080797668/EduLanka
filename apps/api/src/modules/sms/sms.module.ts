import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SmsService } from './sms.service';
import { SmsProcessor } from './sms.processor';
import { SmsController } from './sms.controller';

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

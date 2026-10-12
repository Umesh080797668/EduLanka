import { Module } from '@nestjs/common';
import { PaperHubController } from './paper-hub.controller';
import { PaperHubService } from './paper-hub.service';

@Module({
    controllers: [PaperHubController],
    providers: [PaperHubService],
    exports: [PaperHubService],
})
export class PaperHubModule { }

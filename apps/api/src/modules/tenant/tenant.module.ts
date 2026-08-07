import { Module } from '@nestjs/common';

import { TenantGuard } from '../../common/guards/tenant.guard';

import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
    controllers: [TenantController],
    providers: [TenantService, TenantGuard],
    exports: [TenantService, TenantGuard],
})
export class TenantModule { }

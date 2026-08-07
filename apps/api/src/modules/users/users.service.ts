import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateUserDto } from './dto/create-user.dto';
import type { JwtPayload } from '@edu-lanka/shared-types';

@Injectable()
export class UsersService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async create(dto: CreateUserDto, userPayload: JwtPayload) {
        // Create user logic inside the specific tenant
        const tenantClient = this.supabaseService.getTenantClient(userPayload.tenantId);

        if (!tenantClient || !dto) {
            throw new InternalServerErrorException("Initialization failed");
        }

        return { message: "User created" };
    }
}

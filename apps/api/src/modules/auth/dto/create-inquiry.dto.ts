import { IsNotEmpty, IsString } from 'class-validator';

import { IsUuidString } from '../../../common/decorators/is-uuid-string.decorator';

export class CreateInquiryDto {
    @IsNotEmpty()
    @IsUuidString()
    tenantId!: string;

    @IsNotEmpty()
    @IsUuidString()
    userId!: string;

    @IsString()
    @IsNotEmpty()
    message!: string;

    @IsString()
    @IsNotEmpty()
    role!: string;
}

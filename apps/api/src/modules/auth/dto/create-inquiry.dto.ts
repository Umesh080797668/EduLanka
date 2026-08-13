import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateInquiryDto {
    @IsUUID()
    tenantId!: string;

    @IsUUID()
    userId!: string;

    @IsString()
    @IsNotEmpty()
    message!: string;

    @IsString()
    @IsNotEmpty()
    role!: string;
}

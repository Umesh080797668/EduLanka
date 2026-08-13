import { IsNotEmpty, IsString } from 'class-validator';

export class CreateInquiryDto {
    @IsString()
    @IsNotEmpty()
    tenantId!: string;

    @IsString()
    @IsNotEmpty()
    userId!: string;

    @IsString()
    @IsNotEmpty()
    message!: string;

    @IsString()
    @IsNotEmpty()
    role!: string;
}

import { IsEnum, IsNotEmpty } from 'class-validator';

export enum InquiryStatus {
    PENDING = 'PENDING',
    RESOLVED = 'RESOLVED',
    REJECTED = 'REJECTED'
}

export class UpdateInquiryStatusDto {
    @IsEnum(InquiryStatus)
    @IsNotEmpty()
    status!: InquiryStatus;
}

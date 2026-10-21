import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class BulkImportUserRowDto {
    fullName: string;
    email?: string;
    phoneNumber?: string;
    role?: string;
    customRole?: string;
    password?: string;
    admissionNo?: string;
    classId?: string;
}

export class BulkImportUsersDto {
    @ApiProperty({ description: 'List of user rows parsed from CSV', type: [Object] })
    @IsArray()
    @IsNotEmpty()
    rows: BulkImportUserRowDto[];

    @ApiPropertyOptional({ description: 'Optional custom role mapping dictionary (e.g. {"prefect": "STUDENT"})', type: Object })
    @IsOptional()
    @IsObject()
    customRoleMapping?: Record<string, string>;
}

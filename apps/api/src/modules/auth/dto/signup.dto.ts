import { UserRole } from '@edu-lanka/shared-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsNotEmpty, IsEnum, ValidateIf } from 'class-validator';

import { IsUuidString } from '../../../common/decorators/is-uuid-string.decorator';

export class SignupDto {
    @ApiProperty({ example: 'john.doe@school.edu.lk' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'SecurePass123!', minLength: 8 })
    @IsString()
    @MinLength(8)
    password!: string;

    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    fullName!: string;

    @ApiProperty({ description: 'Tenant UUID the user is registering under', required: false })
    @ValidateIf((o: SignupDto) => o.role !== UserRole.INDEPENDENT_LEARNER)
    @IsNotEmpty()
    @IsUuidString()
    tenantId?: string;

    @ApiProperty({ enum: UserRole, example: UserRole.TEACHER })
    @IsEnum(UserRole)
    role!: UserRole;
}

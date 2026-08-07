import { UserRole } from '@edu-lanka/shared-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsNotEmpty, IsEnum } from 'class-validator';

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

    @ApiProperty({ description: 'Tenant UUID the user is registering under' })
    @IsString()
    @IsNotEmpty()
    tenantId!: string;

    @ApiProperty({ enum: UserRole, example: UserRole.TEACHER })
    @IsEnum(UserRole)
    role!: UserRole;
}

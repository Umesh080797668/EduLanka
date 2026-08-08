import { UserRole } from '@edu-lanka/shared-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsEnum, MinLength, IsOptional } from 'class-validator';

/** Use UserRole from shared-types — the authoritative role definition */
export { UserRole };

export class CreateUserDto {
    @ApiProperty({ example: 'john.doe@school.edu.lk', required: false })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiProperty({ example: '+94771234567', required: false })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    fullName!: string;

    @ApiProperty({ enum: UserRole, example: UserRole.TEACHER })
    @IsEnum(UserRole)
    role!: UserRole;

    @ApiProperty({ minLength: 8 })
    @IsString()
    @MinLength(8)
    password!: string;
}

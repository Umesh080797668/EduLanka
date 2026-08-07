import { IsEmail, IsNotEmpty, IsString, IsEnum } from 'class-validator';

export enum UserRole {
    SCHOOL_ADMIN = 'SCHOOL_ADMIN',
    TEACHER = 'TEACHER',
    STUDENT = 'STUDENT',
    PARENT = 'PARENT'
}

export class CreateUserDto {
    @IsEmail()
    email!: string;

    @IsString()
    @IsNotEmpty()
    fullName!: string;

    @IsEnum(UserRole)
    role!: UserRole;
    
    @IsString()
    password!: string;
}

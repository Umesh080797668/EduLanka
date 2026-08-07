import { Controller, Post, Body, HttpCode, HttpStatus, Version } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

import { AuthService } from './auth.service';

export class LoginDto {
    /** School Admin / Staff email address */
    @IsEmail()
    email!: string;

    /** Password — min 8 characters */
    @IsString()
    @MinLength(8)
    password!: string;

    /** Target tenant to log into */
    @IsString()
    @IsNotEmpty()
    tenantId!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    /**
     * POST /api/v1/auth/login
     * Exchange credentials for a JWT access + refresh token pair.
     */
    @Post('login')
    @Version('1')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login and receive JWT tokens' })
    @ApiOkResponse({ description: 'Access and refresh token pair' })
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto.email, dto.password, dto.tenantId);
    }
}

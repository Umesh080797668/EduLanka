import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsNotEmpty } from 'class-validator';

export class ResetPasswordDto {
    /**
     * The short-lived access token delivered via the Supabase magic-link.
     * The client extracts it from the URL hash (#access_token=...) after
     * the user clicks the password-reset email link.
     */
    @ApiProperty({ description: 'Supabase access token from the password-reset email link' })
    @IsString()
    @IsNotEmpty()
    accessToken!: string;

    @ApiProperty({ example: 'NewSecurePass456!', minLength: 8 })
    @IsString()
    @MinLength(8)
    newPassword!: string;
}

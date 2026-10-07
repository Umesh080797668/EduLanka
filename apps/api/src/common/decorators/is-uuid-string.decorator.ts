import type { ValidationOptions, ValidationArguments } from 'class-validator';
import { registerDecorator } from 'class-validator';

export const UUID_HEX_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Validates that a string is a standard 8-4-4-4-12 hex UUID representation.
 * Compatible with Postgres uuid type, NestJS ParseUUIDPipe, RFC-4122 v4 UUIDs,
 * and deterministic testing identifiers, while rejecting malformed inputs, SQL injections,
 * and arbitrary text.
 */
export function IsUuidString(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: 'isUuidString',
            target: object.constructor,
            propertyName: propertyName,
            options: {
                message: `${propertyName} must be a valid UUID format (8-4-4-4-12 hex string)`,
                ...validationOptions,
            },
            validator: {
                validate(value: any, _args: ValidationArguments) {
                    return typeof value === 'string' && UUID_HEX_REGEX.test(value.trim());
                },
            },
        });
    };
}

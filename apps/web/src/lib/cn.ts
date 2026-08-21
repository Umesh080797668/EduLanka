/**
 * Minimal class-name joiner.
 *
 * We deliberately avoid a `clsx` + `tailwind-merge` dependency here: the design
 * system is built so that variant maps own a given CSS property, and callers
 * append rather than override. Where an override is genuinely needed, put the
 * caller's classes last (which `cn` already does) and rely on Tailwind's
 * source-order — every utility we generate lives in the same layer.
 */
export type ClassValue =
    | string
    | number
    // `ReactNode &&` guards can surface a bigint; accept and ignore it.
    | bigint
    | null
    | undefined
    | false
    | ClassValue[]
    | Record<string, boolean | null | undefined>;

export function cn(...inputs: ClassValue[]): string {
    const out: string[] = [];

    const walk = (value: ClassValue): void => {
        if (!value && value !== 0) return;

        if (typeof value === 'string' || typeof value === 'number') {
            out.push(String(value));
            return;
        }

        if (typeof value === 'bigint') return;

        if (Array.isArray(value)) {
            for (const item of value) walk(item);
            return;
        }

        if (typeof value === 'object') {
            for (const [key, enabled] of Object.entries(value)) {
                if (enabled) out.push(key);
            }
        }
    };

    for (const input of inputs) walk(input);

    return out.join(' ');
}

// =============================================================================
// Notice HTML sanitiser (browser mirror)
// =============================================================================
// The API already scrubs notice bodies on write — see
// `apps/api/src/common/utils/sanitize-html.ts`, which this file mirrors. This
// copy is the second line of defence, and it earns its keep twice:
//
//   1. Rows written before write-side sanitisation existed are still in the
//      database and still get rendered.
//   2. `dangerouslySetInnerHTML` is a one-way door — if any future write path
//      forgets to sanitise, the render path should not be the thing that fails.
//
// Duplicated rather than shared because the API must not depend on the web
// bundle. Keep the two in step; the logic is intentionally identical.
// =============================================================================

/** Structural and inline formatting a notice legitimately needs. */
const ALLOWED_TAGS = new Set([
    'p', 'br', 'hr', 'div', 'span',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'pre', 'code', 'a',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
]);

/**
 * Attributes kept per tag. Everything else — `style`, `on*`, `srcset`, `id`,
 * `class` — is discarded, which removes the event-handler and CSS-injection
 * surface outright rather than trying to filter their contents.
 */
const ALLOWED_ATTRS: Record<string, readonly string[]> = {
    a: ['href', 'title'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
};

/** Dropped together with their contents — unwrapping these would be unsafe. */
const STRIPPED_SUBTREES = [
    'script', 'style', 'iframe', 'object', 'embed', 'applet', 'svg', 'math',
    'template', 'noscript', 'noembed', 'frame', 'frameset', 'form', 'head',
];

const TAG = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;
const ATTR = /([a-zA-Z_:][a-zA-Z0-9:._-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

/** Entities that already encode a character are left alone; bare `&` is escaped. */
const BARE_AMPERSAND = /&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});)/g;

/**
 * Whitespace and C0/C1 control characters. URL parsers ignore these, so
 * `java&#9;script:` and `java script:` must both collapse before the scheme is
 * read — otherwise a prefix test sees a harmless-looking `java`.
 */
const URL_NOISE = /[\u0000-\u0020\u007f-\u009f]/g;

function decodeForSchemeCheck(value: string): string {
    return value
        .replace(/&#x([0-9a-fA-F]+);?/g, (_m, hex: string) =>
            String.fromCodePoint(parseInt(hex, 16) || 0),
        )
        .replace(/&#(\d+);?/g, (_m, dec: string) =>
            String.fromCodePoint(parseInt(dec, 10) || 0),
        )
        .replace(/&(?:tab|newline|colon|NewLine|Tab);/gi, (m) =>
            /colon/i.test(m) ? ':' : '',
        )
        .replace(URL_NOISE, '')
        .toLowerCase();
}

/** http(s), mail, phone and same-document links only — no `javascript:`, no `data:`. */
function isSafeUrl(value: string): boolean {
    const normalized = decodeForSchemeCheck(value);
    if (!normalized) return false;
    const scheme = /^([a-z][a-z0-9+.-]*):/.exec(normalized);
    if (scheme) return /^(?:https?|mailto|tel)$/.test(scheme[1]!);
    return true; // relative path, protocol-relative `//host`, or `#fragment`
}

function escapeAttrValue(value: string): string {
    return value
        .replace(BARE_AMPERSAND, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeText(text: string): string {
    return text.replace(/</g, '&lt;');
}

function buildAttributes(tag: string, raw: string): string {
    const allowed = ALLOWED_ATTRS[tag];
    if (!allowed) return '';

    let out = '';
    let hasHref = false;
    ATTR.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = ATTR.exec(raw)) !== null) {
        const name = match[1]!.toLowerCase();
        if (!allowed.includes(name)) continue;

        const value = match[2] ?? match[3] ?? match[4] ?? '';
        if (name === 'href') {
            if (!isSafeUrl(value)) continue;
            hasHref = true;
        }
        out += ` ${name}="${escapeAttrValue(value)}"`;
    }

    if (tag === 'a' && hasHref) out += ' target="_blank" rel="noopener noreferrer nofollow"';
    return out;
}

/**
 * Strip a notice body down to safe, presentational HTML.
 *
 * Disallowed tags are unwrapped so their text survives; genuinely dangerous
 * subtrees are removed whole. Returns `''` for anything that is not a string.
 */
export function sanitizeNoticeHtml(input: unknown): string {
    if (typeof input !== 'string' || input.length === 0) return '';

    let html = input.replace(/<!--[\s\S]*?(?:-->|$)/g, '').replace(/<![\s\S]*?>/g, '');

    for (const tag of STRIPPED_SUBTREES) {
        html = html.replace(
            new RegExp(`<\\s*${tag}\\b[\\s\\S]*?(?:<\\s*/\\s*${tag}\\s*>|$)`, 'gi'),
            '',
        );
    }

    let out = '';
    let cursor = 0;
    let match: RegExpExecArray | null;
    TAG.lastIndex = 0;

    while ((match = TAG.exec(html)) !== null) {
        out += escapeText(html.slice(cursor, match.index));
        cursor = match.index + match[0].length;

        const name = match[2]!.toLowerCase();
        if (!ALLOWED_TAGS.has(name)) continue; // unwrap — children still render

        out += match[1]
            ? `</${name}>`
            : `<${name}${buildAttributes(name, match[3] ?? '')}>`;
    }

    out += escapeText(html.slice(cursor));
    return out.trim();
}

/** Plain-text projection of a notice — used for list previews and summaries. */
export function noticeHtmlToText(input: unknown): string {
    if (typeof input !== 'string' || input.length === 0) return '';
    return sanitizeNoticeHtml(input)
        .replace(/<\s*(?:br|\/p|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

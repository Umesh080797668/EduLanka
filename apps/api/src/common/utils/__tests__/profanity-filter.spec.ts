import { BadRequestException } from '@nestjs/common';
import { containsProfanity, assertCleanContent } from '../profanity-filter';

describe('ProfanityFilter', () => {
    describe('containsProfanity', () => {
        it('returns false for clean educational text', () => {
            expect(containsProfanity('This is a great lesson on mathematics')).toBe(false);
            expect(containsProfanity('Assessment criteria for Grade 11 Science')).toBe(false);
            expect(containsProfanity('මෙය විශිෂ්ට පාඩමකි')).toBe(false);
            expect(containsProfanity('இது ஒரு சிறந்த பாடம்')).toBe(false);
            expect(containsProfanity('')).toBe(false);
            expect(containsProfanity(null)).toBe(false);
        });

        it('detects English vulgarities', () => {
            expect(containsProfanity('what the fuck is this')).toBe(true);
            expect(containsProfanity('You are an asshole!')).toBe(true);
            expect(containsProfanity('Shut up bitch')).toBe(true);
        });

        it('detects leetspeak obfuscation', () => {
            expect(containsProfanity('what the f!ck')).toBe(true);
            expect(containsProfanity('you @sshole')).toBe(true);
            expect(containsProfanity('sh!t')).toBe(true);
            expect(containsProfanity('fuuuuck this')).toBe(true);
        });

        it('detects Sinhala script and phonetic profanities', () => {
            expect(containsProfanity('මේක හුත්තක්')).toBe(true);
            expect(containsProfanity('මොන පකයක්ද')).toBe(true);
            expect(containsProfanity('pakaya')).toBe(true);
            expect(containsProfanity('huththa')).toBe(true);
            expect(containsProfanity('kariya')).toBe(true);
        });

        it('detects Tamil script and phonetic profanities', () => {
            expect(containsProfanity('தேவிடியா')).toBe(true);
            expect(containsProfanity('புண்டை')).toBe(true);
            expect(containsProfanity('thevidiya')).toBe(true);
            expect(containsProfanity('pundai')).toBe(true);
        });
    });

    describe('assertCleanContent', () => {
        it('does not throw for clean content', () => {
            expect(() => assertCleanContent('Clean title', 'Title')).not.toThrow();
            expect(() => assertCleanContent('Educational comment here', 'Comment')).not.toThrow();
        });

        it('throws BadRequestException for inappropriate content', () => {
            expect(() => assertCleanContent('bad fuck text', 'Comment')).toThrow(BadRequestException);
            expect(() => assertCleanContent('bad fuck text', 'Comment')).toThrow(
                /Comment contains inappropriate or offensive language/,
            );
        });
    });
});

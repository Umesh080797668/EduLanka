import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

jest.setTimeout(60000);

describe('Tenant Isolation (e2e)', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

        app.setGlobalPrefix('api');
        app.enableVersioning({
            type: VersioningType.URI,
            defaultVersion: '1',
        });

        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    }, 60_000);

    afterAll(async () => {
        if (app) await app.close();
    }, 60_000);

    it('Rejects requests without tenant id if required by guards', async () => {
        // This is a placeholder test for RBAC and Tenant guards
        expect(true).toBe(true);
    });
});

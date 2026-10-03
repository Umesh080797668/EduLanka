import { Test, TestingModule } from '@nestjs/testing';
import { NoticesService } from './notices.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SmsService } from '../sms/sms.service';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@edu-lanka/shared-types';

describe('NoticesService', () => {
  let service: NoticesService;
  let supabaseService: any;
  let smsService: jest.Mocked<Partial<SmsService>>;
  let mockTenantFrom: jest.Mock;

  beforeEach(async () => {
    smsService = {
      sendSms: jest.fn().mockResolvedValue({ success: true, queued: true }),
    };

    mockTenantFrom = jest.fn().mockImplementation((table: string) => {
      if (table === 'teachers') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'teacher_1' } }),
            }),
          }),
        };
      }
      if (table === 'class_teachers') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'ct_1' } }),
              }),
            }),
          }),
        };
      }
      if (table === 'notices') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'notice_1', title: 'Test Notice', scope: 'CLASS_SPECIFIC' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
    });

    supabaseService = {
      adminClient: {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'tenant_1', plan: 'STARTER' },
                error: null,
              }),
            }),
          }),
        }),
      },
      getTenantClient: jest.fn().mockReturnValue({
        from: mockTenantFrom,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoticesService,
        { provide: SupabaseService, useValue: supabaseService },
        { provide: SmsService, useValue: smsService },
      ],
    }).compile();

    service = module.get<NoticesService>(NoticesService);
  });

  describe('createNotice role & permission security', () => {
    it('should forbid teacher from creating SCHOOL_WIDE notice', async () => {
      await expect(
        service.createNotice(
          'tenant_1',
          'user_teacher',
          {
            title: 'School Announcement',
            content_html: '<p>Hello everyone</p>',
            scope: 'SCHOOL_WIDE',
          },
          UserRole.TEACHER
        )
      ).rejects.toThrow(new ForbiddenException('Teachers are not permitted to create school-wide notices.'));
    });

    it('should forbid teacher from creating UNIVERSAL notice', async () => {
      await expect(
        service.createNotice(
          'tenant_1',
          'user_teacher',
          {
            title: 'Universal Notice',
            content_html: '<p>Attention all</p>',
            scope: 'UNIVERSAL',
          },
          UserRole.TEACHER
        )
      ).rejects.toThrow(new ForbiddenException('Teachers are not permitted to create school-wide notices.'));
    });

    it('should forbid teacher from sending SMS', async () => {
      await expect(
        service.createNotice(
          'tenant_1',
          'user_teacher',
          {
            title: 'Class Announcement',
            content_html: '<p>Homework due tomorrow</p>',
            scope: 'CLASS_SPECIFIC',
            target_class_id: 'class_1',
            send_sms: true,
          },
          UserRole.TEACHER
        )
      ).rejects.toThrow(new ForbiddenException('Teachers are not permitted to trigger SMS notifications.'));
    });

    it('should forbid teacher from bypassing quota', async () => {
      await expect(
        service.createNotice(
          'tenant_1',
          'user_teacher',
          {
            title: 'Class Announcement',
            content_html: '<p>Homework due tomorrow</p>',
            scope: 'CLASS_SPECIFIC',
            target_class_id: 'class_1',
            bypass_quota: true,
          },
          UserRole.TEACHER
        )
      ).rejects.toThrow(new ForbiddenException('Only System Administrators can bypass SMS quotas.'));
    });

    it('should forbid school admin from bypassing quota', async () => {
      await expect(
        service.createNotice(
          'tenant_1',
          'user_principal',
          {
            title: 'School-wide Notice',
            content_html: '<p>School event</p>',
            scope: 'SCHOOL_WIDE',
            send_sms: true,
            bypass_quota: true,
          },
          UserRole.SCHOOL_ADMIN
        )
      ).rejects.toThrow(new ForbiddenException('Only System Administrators can bypass SMS quotas.'));
    });

    it('should allow teacher to create CLASS_SPECIFIC notice for assigned class without SMS', async () => {
      const result = await service.createNotice(
        'tenant_1',
        'user_teacher',
        {
          title: 'Class Homework',
          content_html: '<p>Assignment details</p>',
          scope: 'CLASS_SPECIFIC',
          target_class_id: 'class_1',
        },
        UserRole.TEACHER
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('notice_1');
    });

    it('should allow school admin to create SCHOOL_WIDE notice with SMS within quota', async () => {
      const result = await service.createNotice(
        'tenant_1',
        'user_principal',
        {
          title: 'Sports Day Announcement',
          content_html: '<p>Sports meet on Friday</p>',
          scope: 'SCHOOL_WIDE',
          send_sms: true,
        },
        UserRole.SCHOOL_ADMIN
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('notice_1');
    });
  });
});

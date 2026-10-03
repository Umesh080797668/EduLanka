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

  describe('broadcastGlobalNotice', () => {
    it('should continue across tenants even if one tenant throws, and suppress SMS on Community', async () => {
      supabaseService.adminClient.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'tenants') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { id: 'tenant_comm', plan: 'COMMUNITY', status: 'ACTIVE', name: 'Comm School' },
                  { id: 'tenant_err', plan: 'STARTER', status: 'ACTIVE', name: 'Err School' },
                  { id: 'tenant_ok', plan: 'STARTER', status: 'ACTIVE', name: 'Ok School' },
                ],
                error: null,
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
        };
      });

      jest.spyOn(service, 'createNotice').mockImplementation(async (tenantId, _author, req) => {
        if (tenantId === 'tenant_comm') {
          expect(req.send_sms).toBe(false); // Suppressed for Community
          return { id: 'notice_comm' } as any;
        }
        if (tenantId === 'tenant_err') {
          throw new Error('Database connection failed');
        }
        return { id: 'notice_ok' } as any;
      });

      const result = await service.broadcastGlobalNotice('super_admin_id', {
        title: 'Platform Maintenance Announcement',
        content_html: '<p>Update tonight</p>',
        send_sms: true,
      });

      expect(result.success).toBe(true);
      expect(result.dispatches).toBe(2);
      expect(result.failedTenants).toHaveLength(1);
      expect(result.failedTenants[0].tenantId).toBe('tenant_err');
    });
  });

  describe('getNotices scoping enforcement', () => {
    it('should forbid student from querying arbitrary class notice', async () => {
      mockTenantFrom.mockImplementation((table: string) => {
        if (table === 'students') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { class_id: 'enrolled_class_id', classes: { grade: 7 } },
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      await expect(
        service.getNotices('tenant_1', 'student_1', UserRole.STUDENT, 'unauthorized_class_id')
      ).rejects.toThrow(new ForbiddenException('You can only access notices for your enrolled class.'));
    });

    it('should forbid student from querying arbitrary grade notice', async () => {
      mockTenantFrom.mockImplementation((table: string) => {
        if (table === 'students') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { class_id: 'enrolled_class_id', classes: { grade: 7 } },
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      await expect(
        service.getNotices('tenant_1', 'student_1', UserRole.STUDENT, undefined, '10')
      ).rejects.toThrow(new ForbiddenException('You can only access notices for your enrolled grade.'));
    });
  });
});

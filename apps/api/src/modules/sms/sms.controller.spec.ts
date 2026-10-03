import { Test, TestingModule } from '@nestjs/testing';
import { SmsController } from './sms.controller';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { HttpStatus } from '@nestjs/common';
import * as twilio from 'twilio';

jest.mock('twilio');

describe('SmsController', () => {
  let controller: SmsController;
  let configService: jest.Mocked<Partial<ConfigService>>;
  let supabaseService: any;
  let mockDbUpdate: jest.Mock;
  let mockDbEq: jest.Mock;

  beforeEach(async () => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'twilio.authToken') return 'test_auth_token';
        if (key === 'app.publicUrl') return 'https://api.edulanka.lk';
        return undefined;
      }),
    };

    mockDbEq = jest.fn().mockResolvedValue({ data: null, error: null });
    mockDbUpdate = jest.fn().mockReturnValue({ eq: mockDbEq });

    supabaseService = {
      adminClient: {
        from: jest.fn().mockReturnValue({
          update: mockDbUpdate,
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SmsController],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    controller = module.get<SmsController>(SmsController);
  });

  describe('handleTwilioWebhook', () => {
    it('should reject webhook with 403 if x-twilio-signature header is missing', async () => {
      const mockReq = {
        headers: {},
        body: { MessageSid: 'SM123', MessageStatus: 'delivered' },
      };
      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.handleTwilioWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockRes.send).toHaveBeenCalledWith('Missing X-Twilio-Signature header');
      expect(supabaseService.adminClient.from).not.toHaveBeenCalled();
    });

    it('should reject webhook with 403 if twilio signature is invalid', async () => {
      (twilio.validateRequest as jest.Mock).mockReturnValue(false);

      const mockReq = {
        headers: { 'x-twilio-signature': 'invalid_sig' },
        body: { MessageSid: 'SM123', MessageStatus: 'delivered' },
      };
      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.handleTwilioWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockRes.send).toHaveBeenCalledWith('Invalid Signature');
      expect(supabaseService.adminClient.from).not.toHaveBeenCalled();
    });

    it('should process webhook and update sms_logs when signature is valid', async () => {
      (twilio.validateRequest as jest.Mock).mockReturnValue(true);

      const mockReq = {
        headers: { 'x-twilio-signature': 'valid_sig' },
        body: { MessageSid: 'SM123', MessageStatus: 'delivered' },
      };
      const mockRes: any = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.handleTwilioWebhook(mockReq, mockRes);

      expect(twilio.validateRequest).toHaveBeenCalledWith(
        'test_auth_token',
        'valid_sig',
        'https://api.edulanka.lk/api/v1/sms/webhook',
        mockReq.body
      );
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(supabaseService.adminClient.from).toHaveBeenCalledWith('sms_logs');
      expect(mockDbUpdate).toHaveBeenCalledWith({ status: 'DELIVERED', error_code: null });
      expect(mockDbEq).toHaveBeenCalledWith('twilio_sid', 'SM123');
    });
  });
});

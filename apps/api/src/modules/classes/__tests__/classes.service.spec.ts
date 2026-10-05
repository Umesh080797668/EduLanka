import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { ChatService } from '../../chat/chat.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { ClassesService } from '../classes.service';

describe('ClassesService', () => {
  let service: ClassesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        {
          provide: SupabaseService,
          useValue: { getTenantClient: jest.fn(), adminClient: { auth: { admin: { deleteUser: jest.fn() } } } }
        },
        {
          provide: ChatService,
          useValue: { syncClassParticipants: jest.fn().mockResolvedValue(0) }
        }
      ],
    }).compile();

    service = module.get<ClassesService>(ClassesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

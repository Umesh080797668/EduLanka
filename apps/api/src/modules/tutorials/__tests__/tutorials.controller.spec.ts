import { Test, TestingModule } from '@nestjs/testing';
import { TutorialsController } from '../tutorials.controller';
import { TutorialsService } from '../tutorials.service';

describe('TutorialsController', () => {
    let controller: TutorialsController;
    let service: TutorialsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [TutorialsController],
            providers: [
                {
                    provide: TutorialsService,
                    useValue: {
                        getTutorialForScreen: jest.fn().mockResolvedValue({ success: true }),
                        getUserCompletions: jest.fn().mockResolvedValue({ success: true, data: [] }),
                        updateUserStatus: jest.fn().mockResolvedValue({ success: true }),
                        getTenantStats: jest.fn().mockResolvedValue({ success: true }),
                        createTutorial: jest.fn().mockResolvedValue({ success: true }),
                    },
                },
            ],
        }).compile();

        controller = module.get<TutorialsController>(TutorialsController);
        service = module.get<TutorialsService>(TutorialsService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('getTutorialByScreen routes properly', async () => {
        const result = await controller.getTutorialByScreen('STUDENT', 'home');
        expect(result.success).toBe(true);
        expect(service.getTutorialForScreen).toHaveBeenCalledWith('STUDENT', 'home');
    });

    it('getMyTutorials routes properly', async () => {
        const result = await controller.getMyTutorials({ sub: 'admin-id' } as any);
        expect(result.success).toBe(true);
        expect(service.getUserCompletions).toHaveBeenCalled();
    });

    it('updateMyTutorialStatus routes properly', async () => {
        const dto = { status: 'COMPLETED' as any };
        const result = await controller.updateMyTutorialStatus('tut-1', dto, { sub: 'admin-id' } as any);
        expect(result.success).toBe(true);
        expect(service.updateUserStatus).toHaveBeenCalledWith('tut-1', 'COMPLETED', expect.any(Object));
    });
});

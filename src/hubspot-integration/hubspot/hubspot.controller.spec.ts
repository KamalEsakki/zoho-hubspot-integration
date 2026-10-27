import { Test, TestingModule } from '@nestjs/testing';
import { HubspotController } from './hubspot.controller';

describe('HubspotController', () => {
  let controller: HubspotController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HubspotController],
    }).compile();

    controller = module.get<HubspotController>(HubspotController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

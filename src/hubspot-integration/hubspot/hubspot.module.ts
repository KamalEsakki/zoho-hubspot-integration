import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HubspotController } from './hubspot.controller';
import { HubspotMigrationService } from './hubspot-migration.service';
import { HubspotCredentialEntity } from './entities/hubspot-credential.entity';
import { ZohoCredentialEntity } from '../../zoho-integration/entities/zoho-credential.entity';
import { MigrationLogEntity } from './entities/migration-log.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            HubspotCredentialEntity,
            ZohoCredentialEntity,
            MigrationLogEntity,
        ]),
    ],
    controllers: [HubspotController],
    providers: [HubspotMigrationService],
})
export class HubspotModule { }
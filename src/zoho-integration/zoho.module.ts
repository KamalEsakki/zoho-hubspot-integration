
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ZohoController } from './zoho.controller';
import { ZohoCredentialEntity } from './entities/zoho-credential.entity';
import { DealInvoiceEntity } from './entities/deal-invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ZohoCredentialEntity,
      DealInvoiceEntity,
    ]),
  ],
  controllers: [ZohoController],
})
export class ZohoModule { }
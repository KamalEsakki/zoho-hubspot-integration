import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Post,
    Query,
    Res,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { handleHubspotError } from './hubspot.error';
import { HubspotMigrationService } from './hubspot-migration.service';

import { HubspotCredentialEntity } from './entities/hubspot-credential.entity';
import { ZohoCredentialEntity } from '../../zoho-integration/entities/zoho-credential.entity';
import { zohoConfig } from '../../zoho-integration/config';
import { MigrationLogEntity } from './entities/migration-log.entity';


import {
    createHubspotContact,
    createHubspotCompany,
    createHubspotLead,
    createHubspotDeal,
    findHubspotCompanyByName,
    associateContactWithCompany,
    exchangeHubspotCode,
    getHubspotContactById,
    getHubspotContacts,
    getHubspotDeals,
    getHubspotDealById,
    findHubspotContactByEmail,
    updateHubspotContact,
    updateHubspotDeal,
    refreshHubspotToken,
} from './hubspot.action';

import { hubspotConfig } from './hubspot.config';

@Controller('hubspot')
export class HubspotController {
    constructor(
        private readonly configService: ConfigService,
        private readonly hubspotMigrationService: HubspotMigrationService,

        @InjectRepository(HubspotCredentialEntity)
        private readonly hubspotCredentialRepository: Repository<HubspotCredentialEntity>,

        @InjectRepository(ZohoCredentialEntity)
        private readonly zohoCredentialRepository: Repository<ZohoCredentialEntity>,
        @InjectRepository(MigrationLogEntity)
        private readonly migrationLogRepository: Repository<MigrationLogEntity>,


    ) { }
    @Post('migration/contact')
    async migrateContact(
        @Body()
        body: {
            zohoContactId: string;
            zohoAccessToken?: string;
            hubspotAccessToken?: string;
        },
    ) {
        if (!body?.zohoContactId?.trim()) {
            throw new HttpException('zohoContactId is required', HttpStatus.BAD_REQUEST);
        }
        const zohoAccessToken =
            await this.getValidZohoAccessToken(body.zohoAccessToken);
        const hubspotAccessToken =
            await this.getValidHubspotAccessToken(body.hubspotAccessToken);

        if (!zohoAccessToken || !hubspotAccessToken) {
            throw new HttpException(
                'Zoho or HubSpot credentials not found or expired',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            return await this.hubspotMigrationService.migrateContact(
                zohoAccessToken,
                hubspotAccessToken,
                body.zohoContactId.trim(),
            );
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Contact migration failed',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('migration/contact/date-range')
    async migrateContactsByDateRange(
        @Body()
        body: {
            startDate: string;
            endDate: string;
            zohoAccessToken?: string;
            hubspotAccessToken?: string;
        },
    ) {
        if (!body?.startDate?.trim() || !body?.endDate?.trim()) {
            throw new HttpException('startDate and endDate are required', HttpStatus.BAD_REQUEST);
        }
        const zohoAccessToken =
            await this.getValidZohoAccessToken(body.zohoAccessToken);
        const hubspotAccessToken =
            await this.getValidHubspotAccessToken(body.hubspotAccessToken);

        if (!zohoAccessToken || !hubspotAccessToken) {
            throw new HttpException(
                'Zoho or HubSpot credentials not found or expired',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            return await this.hubspotMigrationService.migrateContactsByDateRange(
                zohoAccessToken,
                hubspotAccessToken,
                body.startDate.trim(),
                body.endDate.trim(),
            );
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Contacts date-range migration failed',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('migration/lead')
    async migrateLead(
        @Body()
        body: {
            zohoLeadId: string;
            zohoAccessToken?: string;
            hubspotAccessToken?: string;
        },
    ) {
        if (!body?.zohoLeadId?.trim()) {
            throw new HttpException('zohoLeadId is required', HttpStatus.BAD_REQUEST);
        }
        const zohoAccessToken =
            await this.getValidZohoAccessToken(body.zohoAccessToken);
        const hubspotAccessToken =
            await this.getValidHubspotAccessToken(body.hubspotAccessToken);

        if (!zohoAccessToken || !hubspotAccessToken) {
            throw new HttpException(
                'Zoho or HubSpot credentials not found or expired',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            return await this.hubspotMigrationService.migrateLead(
                zohoAccessToken,
                hubspotAccessToken,
                body.zohoLeadId.trim(),
            );
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Lead migration failed',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
    @Post('migration/deal')
    async migrateDeal(
        @Body() body: {
            zohoDealId: string;
            zohoAccessToken?: string;
            hubspotAccessToken?: string;
        },
    ) {
        if (!body?.zohoDealId?.trim()) {
            throw new HttpException('zohoDealId is required', HttpStatus.BAD_REQUEST);
        }
        const zohoAccessToken =
            await this.getValidZohoAccessToken(body.zohoAccessToken);
        const hubspotAccessToken =
            await this.getValidHubspotAccessToken(body.hubspotAccessToken);

        if (!zohoAccessToken || !hubspotAccessToken) {
            throw new HttpException(
                'Zoho or HubSpot credentials not found or expired',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            return await this.hubspotMigrationService.migrateDeal(
                zohoAccessToken,
                hubspotAccessToken,
                body.zohoDealId.trim(),
            );
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Deal migration failed',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }


    @Post('migration/deal/date-range')
    async migrateDealsByDateRange(
        @Body()
        body: {
            startDate: string;
            endDate: string;
            zohoAccessToken?: string;
            hubspotAccessToken?: string;
        },
    ) {
        if (!body?.startDate?.trim() || !body?.endDate?.trim()) {
            throw new HttpException('startDate and endDate are required', HttpStatus.BAD_REQUEST);
        }
        const zohoAccessToken =
            await this.getValidZohoAccessToken(body.zohoAccessToken);

        const hubspotAccessToken =
            await this.getValidHubspotAccessToken(body.hubspotAccessToken);

        if (!zohoAccessToken || !hubspotAccessToken) {
            throw new HttpException(
                'Zoho or HubSpot credentials not found or expired',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            return await this.hubspotMigrationService.migrateDealsByDateRange(
                zohoAccessToken,
                hubspotAccessToken,
                body.startDate.trim(),
                body.endDate.trim(),
            );
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Deals date-range migration failed',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('migration/account')
    async migrateAccount(
        @Body()
        body: {
            zohoAccountId: string;
            zohoAccessToken?: string;
            hubspotAccessToken?: string;
        },
    ) {
        if (!body?.zohoAccountId?.trim()) {
            throw new HttpException('zohoAccountId is required', HttpStatus.BAD_REQUEST);
        }
        const zohoAccessToken =
            await this.getValidZohoAccessToken(body.zohoAccessToken);
        const hubspotAccessToken =
            await this.getValidHubspotAccessToken(body.hubspotAccessToken);

        if (!zohoAccessToken || !hubspotAccessToken) {
            throw new HttpException(
                'Zoho or HubSpot credentials not found or expired',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            return await this.hubspotMigrationService.migrateAccount(
                zohoAccessToken,
                hubspotAccessToken,
                body.zohoAccountId.trim(),
            );
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Account migration failed',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
    @Post('migration/lead/date-range')
    async migrateLeadsByDateRange(
        @Body()
        body: {
            startDate: string;
            endDate: string;
            zohoAccessToken?: string;
            hubspotAccessToken?: string;
        },
    ) {
        if (!body?.startDate?.trim() || !body?.endDate?.trim()) {
            throw new HttpException('startDate and endDate are required', HttpStatus.BAD_REQUEST);
        }
        const zohoAccessToken =
            await this.getValidZohoAccessToken(body.zohoAccessToken);
        const hubspotAccessToken =
            await this.getValidHubspotAccessToken(body.hubspotAccessToken);

        if (!zohoAccessToken || !hubspotAccessToken) {
            throw new HttpException(
                'Zoho or HubSpot credentials not found or expired',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            return await this.hubspotMigrationService.migrateLeadsByDateRange(
                zohoAccessToken,
                hubspotAccessToken,
                body.startDate.trim(),
                body.endDate.trim(),
            );
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Leads date-range migration failed',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('migration/account/date-range')
    async migrateAccountsByDateRange(
        @Body()
        body: {
            startDate: string;
            endDate: string;
            zohoAccessToken?: string;
            hubspotAccessToken?: string;
        },
    ) {
        if (!body?.startDate?.trim() || !body?.endDate?.trim()) {
            throw new HttpException('startDate and endDate are required', HttpStatus.BAD_REQUEST);
        }
        const zohoAccessToken =
            await this.getValidZohoAccessToken(body.zohoAccessToken);

        const hubspotAccessToken =
            await this.getValidHubspotAccessToken(body.hubspotAccessToken);

        if (!zohoAccessToken || !hubspotAccessToken) {
            throw new HttpException(
                'Zoho or HubSpot credentials not found or expired',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            return await this.hubspotMigrationService.migrateAccountsByDateRange(
                zohoAccessToken,
                hubspotAccessToken,
                body.startDate.trim(),
                body.endDate.trim(),
            );
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Accounts date-range migration failed',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async getValidHubspotAccessToken(
        explicitToken?: string,
    ): Promise<string> {
        if (explicitToken?.trim()) {
            return explicitToken.trim();
        }

        const credential =
            await this.hubspotCredentialRepository.findOne({
                where: {},
                order: {
                    id: 'DESC',
                },
            });

        if (!credential) {
            return '';
        }

        const now = Date.now();
        const expiresAt = credential.expiresAt
            ? credential.expiresAt.getTime()
            : 0;
        let accessToken = credential.accessToken;

        if (!expiresAt || expiresAt - now <= 60_000) {
            const clientId =
                this.configService.get<string>('HUBSPOT_CLIENT_ID');
            const clientSecret =
                this.configService.get<string>('HUBSPOT_CLIENT_SECRET');

            try {
                const tokenData = await refreshHubspotToken(
                    clientId ?? '',
                    clientSecret ?? '',
                    credential.refreshToken,
                );

                if (!tokenData?.access_token) {
                    return '';
                }

                credential.accessToken = tokenData.access_token;
                if (tokenData.refresh_token) {
                    credential.refreshToken = tokenData.refresh_token;
                }
                credential.expiresAt = new Date(
                    Date.now() + (Number(tokenData.expires_in) || 1800) * 1000,
                );
                await this.hubspotCredentialRepository.save(credential);
                accessToken = credential.accessToken;
            } catch (error: any) {
                return '';
            }
        }

        return accessToken;
    }

    private async getValidZohoAccessToken(
        explicitToken?: string,
    ): Promise<string> {
        if (explicitToken?.trim()) {
            return explicitToken.trim();
        }

        const zohoCred =
            await this.zohoCredentialRepository.findOne({
                where: {},
                order: {
                    id: 'DESC',
                },
            });

        if (!zohoCred) {
            return '';
        }

        const now = Date.now();
        const expiresAt = zohoCred.expiresAt
            ? zohoCred.expiresAt.getTime()
            : 0;

        if (
            expiresAt &&
            expiresAt - now > 60_000
        ) {
            return zohoCred.accessToken;
        }

        try {
            const clientId =
                this.configService.get<string>('ZOHO_CLIENT_ID');
            const clientSecret =
                this.configService.get<string>('ZOHO_CLIENT_SECRET');

            const response = await axios.post(
                zohoConfig.tokenUrl,
                null,
                {
                    params: {
                        refresh_token: zohoCred.refreshToken,
                        client_id: clientId,
                        client_secret: clientSecret,
                        grant_type: 'refresh_token',
                    },
                },
            );

            if (!response.data?.access_token) {
                return '';
            }

            zohoCred.accessToken = response.data.access_token;

            if (response.data.expires_in) {
                zohoCred.expiresAt = new Date(
                    Date.now() + Number(response.data.expires_in) * 1000,
                );
            }

            await this.zohoCredentialRepository.save(zohoCred);
            return zohoCred.accessToken;
        } catch (error: any) {
            return '';
        }
    }

    @Post('migration/hubspot-to-zoho/contact')
    async migrateHubspotContactToZoho(
        @Body()
        body: {
            hubspotContactId: string;
            zohoAccessToken?: string;
            hubspotAccessToken?: string;
        },
    ) {
        if (!body?.hubspotContactId?.trim()) {
            throw new HttpException('hubspotContactId is required', HttpStatus.BAD_REQUEST);
        }
        const hubspotAccessToken =
            await this.getValidHubspotAccessToken(body.hubspotAccessToken);
        const zohoAccessToken =
            await this.getValidZohoAccessToken(body.zohoAccessToken);

        if (!hubspotAccessToken || !zohoAccessToken) {
            throw new HttpException(
                'Zoho or HubSpot credentials not found or expired',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            return await this.hubspotMigrationService.migrateHubspotContactToZoho(
                hubspotAccessToken,
                zohoAccessToken,
                body.hubspotContactId.trim(),
            );
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Reverse contact migration failed',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }



    @Post('migration/hubspot-to-zoho/company')
    async migrateHubspotCompanyToZoho(
        @Body()
        body: {
            hubspotCompanyId: string;
            zohoAccessToken?: string;
            hubspotAccessToken?: string;
        },
    ) {
        if (!body?.hubspotCompanyId?.trim()) {
            throw new HttpException(
                'hubspotCompanyId is required',
                HttpStatus.BAD_REQUEST,
            );
        }

        const hubspotAccessToken =
            await this.getValidHubspotAccessToken(body.hubspotAccessToken);
        const zohoAccessToken =
            await this.getValidZohoAccessToken(body.zohoAccessToken);

        if (!hubspotAccessToken || !zohoAccessToken) {
            throw new HttpException(
                'Zoho or HubSpot credentials not found or expired',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            return await this.hubspotMigrationService.migrateHubspotCompanyToZoho(
                hubspotAccessToken,
                zohoAccessToken,
                body.hubspotCompanyId.trim(),
            );
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Reverse company migration failed',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
    @Post('migration/hubspot-to-zoho/deal')
    async migrateHubspotDealToZoho(
        @Body()
        body: {
            hubspotDealId: string;
            zohoAccessToken?: string;
            hubspotAccessToken?: string;
        },
    ) {
        if (!body?.hubspotDealId?.trim()) {
            throw new HttpException(
                'hubspotDealId is required',
                HttpStatus.BAD_REQUEST,
            );
        }

        const hubspotAccessToken =
            await this.getValidHubspotAccessToken(body.hubspotAccessToken);

        const zohoAccessToken =
            await this.getValidZohoAccessToken(body.zohoAccessToken);

        if (!hubspotAccessToken || !zohoAccessToken) {
            throw new HttpException(
                'Zoho or HubSpot credentials not found or expired',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            return await this.hubspotMigrationService.migrateHubspotDealToZoho(
                hubspotAccessToken,
                zohoAccessToken,
                body.hubspotDealId.trim(),
            );
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Reverse deal migration failed',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
    @Post('migration/hubspot-to-zoho/deal/date-range')
    async migrateHubspotDealsByDateRange(
        @Body()
        body: {
            startDate: string;
            endDate: string;
            zohoAccessToken?: string;
            hubspotAccessToken?: string;
        },
    ) {
        if (!body?.startDate?.trim()) {
            throw new HttpException(
                'startDate is required',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!body?.endDate?.trim()) {
            throw new HttpException(
                'endDate is required',
                HttpStatus.BAD_REQUEST,
            );
        }

        const hubspotAccessToken =
            await this.getValidHubspotAccessToken(body.hubspotAccessToken);

        const zohoAccessToken =
            await this.getValidZohoAccessToken(body.zohoAccessToken);

        if (!hubspotAccessToken || !zohoAccessToken) {
            throw new HttpException(
                'Zoho or HubSpot credentials not found or expired',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            return await this.hubspotMigrationService
                .migrateHubspotDealsByDateRange(
                    hubspotAccessToken,
                    zohoAccessToken,
                    body.startDate.trim(),
                    body.endDate.trim(),
                );
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Reverse deals date-range migration failed',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('migration/hubspot-to-zoho/company/date-range')
    async migrateHubspotCompaniesByDateRange(
        @Body()
        body: {
            startDate: string;
            endDate: string;
            zohoAccessToken?: string;
            hubspotAccessToken?: string;
        },
    ) {
        if (!body?.startDate?.trim() || !body?.endDate?.trim()) {
            throw new HttpException('startDate and endDate are required', HttpStatus.BAD_REQUEST);
        }
        const hubspotAccessToken =
            await this.getValidHubspotAccessToken(body.hubspotAccessToken);
        const zohoAccessToken =
            await this.getValidZohoAccessToken(body.zohoAccessToken);

        if (!hubspotAccessToken || !zohoAccessToken) {
            throw new HttpException(
                'Zoho or HubSpot credentials not found or expired',
                HttpStatus.UNAUTHORIZED,
            );
        }

        try {
            return await this.hubspotMigrationService.migrateHubspotCompaniesByDateRange(
                hubspotAccessToken,
                zohoAccessToken,
                body.startDate.trim(),
                body.endDate.trim(),
            );
        } catch (error: any) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Reverse companies date-range migration failed',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
    @Get('auth')
    auth(@Res() res: Response) {
        const clientId =
            this.configService.get<string>(
                'HUBSPOT_CLIENT_ID',
            );

        const redirectUri =
            this.configService.get<string>(
                'HUBSPOT_REDIRECT_URI',
            );

        const authUrl =
            `${hubspotConfig.oauthUrl}` +
            `?client_id=${clientId}` +
            `&redirect_uri=${encodeURIComponent(
                redirectUri ?? '',
            )}` +
            `&scope=${encodeURIComponent(
                hubspotConfig.scopes.join(' '),
            )}` +
            `&prompt=consent`;

        return res.redirect(authUrl);
    }


    @Get('callback')
    async callback(
        @Query('code') code: string,
    ) {
        const clientId =
            this.configService.get<string>(
                'HUBSPOT_CLIENT_ID',
            );

        const clientSecret =
            this.configService.get<string>(
                'HUBSPOT_CLIENT_SECRET',
            );

        const redirectUri =
            this.configService.get<string>(
                'HUBSPOT_REDIRECT_URI',
            );

        try {
            const tokenData =
                await exchangeHubspotCode(
                    clientId ?? '',
                    clientSecret ?? '',
                    redirectUri ?? '',
                    code,
                );

            const expiresAt =
                new Date(
                    Date.now() +
                    tokenData.expires_in * 1000,
                );

            const credential =
                this.hubspotCredentialRepository.create({
                    accessToken:
                        tokenData.access_token,

                    refreshToken:
                        tokenData.refresh_token,

                    expiresAt,
                });

            await this.hubspotCredentialRepository.save(
                credential,
            );

            return {
                message:
                    'HubSpot OAuth successful',

                expiresIn:
                    tokenData.expires_in,

                savedToDatabase:
                    true,
            };
        } catch (error) {
            return handleHubspotError(error);
        }
    }

    @Get('refresh')
    async refreshToken() {
        const credential =
            await this.hubspotCredentialRepository.findOne({
                where: {},
                order: {
                    id: 'DESC',
                },
            });

        if (!credential) {
            return {
                message:
                    'HubSpot credentials not found',
            };
        }

        const clientId =
            this.configService.get<string>(
                'HUBSPOT_CLIENT_ID',
            );

        const clientSecret =
            this.configService.get<string>(
                'HUBSPOT_CLIENT_SECRET',
            );

        try {
            const tokenData =
                await refreshHubspotToken(
                    clientId ?? '',
                    clientSecret ?? '',
                    credential.refreshToken,
                );

            credential.accessToken =
                tokenData.access_token;

            if (tokenData.refresh_token) {
                credential.refreshToken =
                    tokenData.refresh_token;
            }

            credential.expiresAt =
                new Date(
                    Date.now() +
                    tokenData.expires_in * 1000,
                );

            await this.hubspotCredentialRepository.save(
                credential,
            );

            return {
                message:
                    'HubSpot token refreshed successfully',

                expiresIn:
                    tokenData.expires_in,

                savedToDatabase:
                    true,
            };
        } catch (error) {
            return handleHubspotError(error);
        }
    }

    @Post('contacts')
    async getContacts(
        @Body()
        body: {
            limit?: number;
            after?: string;
        },
    ) {
        const accessToken =
            await this.getValidHubspotAccessToken();

        if (!accessToken) {
            return {
                message:
                    'HubSpot credentials not found',
            };
        }

        try {
            return await getHubspotContacts(
                accessToken,
                body.limit ?? 10,
                body.after,
            );
        } catch (error) {
            return handleHubspotError(error);
        }
    }
    @Post('deals')
    async getDeals(
        @Body()
        body: {
            limit?: number;
            after?: string;
        },
    ) {
        const accessToken =
            await this.getValidHubspotAccessToken();

        if (!accessToken) {
            return {
                statusCode: 401,
                message: 'HubSpot credentials not found',
            };
        }

        try {
            return await getHubspotDeals(
                accessToken,
                body.limit ?? 10,
                body.after,
            );
        } catch (error) {
            return handleHubspotError(error);
        }
    }
    @Post('deal/create')
    async createDeal(
        @Body()
        body: {
            dealname?: string;
            amount?: string;
            dealstage?: string;
            closedate?: string;
        },
    ) {
        if (!body.dealname?.trim()) {
            return {
                statusCode: 400,
                message: 'Deal name is required',
            };
        }

        const accessToken =
            await this.getValidHubspotAccessToken();

        if (!accessToken) {
            return {
                statusCode: 401,
                message: 'HubSpot credentials not found',
            };
        }

        try {
            return await createHubspotDeal(
                accessToken,
                {
                    dealname: body.dealname.trim(),
                    amount: body.amount,
                    dealstage: body.dealstage,
                    closedate: body.closedate,
                },
            );
        } catch (error) {
            return handleHubspotError(error);
        }
    }
    @Post('deal/update')
    async updateDeal(
        @Body()
        body: {
            id?: string;
            dealname?: string;
            amount?: string;
            dealstage?: string;
            closedate?: string;
        },
    ) {
        if (!body.id?.trim()) {
            return {
                statusCode: 400,
                message: 'Deal ID is required',
            };
        }

        const accessToken =
            await this.getValidHubspotAccessToken();

        if (!accessToken) {
            return {
                statusCode: 401,
                message: 'HubSpot credentials not found',
            };
        }

        try {
            return await updateHubspotDeal(
                accessToken,
                body.id.trim(),
                {
                    dealname: body.dealname,
                    amount: body.amount,
                    dealstage: body.dealstage,
                    closedate: body.closedate,
                },
            );
        } catch (error) {
            return handleHubspotError(error);
        }
    }

    @Post('company/create')
    async createCompany(
        @Body()
        body: {
            name?: string;
            phone?: string;
            website?: string;
            industry?: string;
        },
    ) {
        if (!body.name?.trim()) {
            return {
                statusCode: 400,
                message: 'Company name is required',
            };
        }

        const accessToken =
            await this.getValidHubspotAccessToken();

        if (!accessToken) {
            return {
                message: 'HubSpot credentials not found',
            };
        }

        try {
            return await createHubspotCompany(
                accessToken,
                {
                    name: body.name.trim(),
                    ...(body.phone !== undefined ? { phone: body.phone } : {}),
                    ...(body.website !== undefined ? { website: body.website } : {}),
                    ...(body.industry !== undefined ? { industry: body.industry } : {}),
                },
            );
        } catch (error) {
            return handleHubspotError(error);
        }
    }

    @Post('lead/create')
    async createLead(
        @Body()
        body: {
            firstname?: string;
            lastname?: string;
            email?: string;
            phone?: string;
            company?: string;
        },
    ) {
        if (
            !body.firstname?.trim() &&
            !body.lastname?.trim() &&
            !body.email?.trim() &&
            !body.phone?.trim() &&
            !body.company?.trim()
        ) {
            return {
                statusCode: 400,
                message:
                    'At least one lead field (firstname, lastname, email, phone, or company) is required',
            };
        }

        try {
            const accessToken = await this.getValidHubspotAccessToken();

            if (!accessToken) {
                return {
                    statusCode: 401,
                    message: 'HubSpot credentials not found',
                };
            }

            return await createHubspotLead(accessToken, body);
        } catch (error) {
            return handleHubspotError(error);
        }
    }

    @Post('contact/associate-company')
    async associateContactWithCompany(
        @Body()
        body: {
            contactId?: string;
            companyId?: string;
        },
    ) {
        if (!body.contactId || !body.companyId) {
            return {
                statusCode: 400,
                message: 'Both contactId and companyId are required',
            };
        }

        const accessToken =
            await this.getValidHubspotAccessToken();

        if (!accessToken) {
            return {
                message: 'HubSpot credentials not found',
            };
        }

        try {
            return await associateContactWithCompany(
                accessToken,
                body.contactId,
                body.companyId,
            );
        } catch (error) {
            return handleHubspotError(error);
        }
    }

    @Post('contact/create')
    async createContact(
        @Body()
        body: {
            firstname?: string;
            lastname?: string;
            email?: string;
            phone?: string;
            company?: string;
            companyId?: string;
        },
    ) {
        if (!body.firstname && !body.lastname && !body.email) {
            return {
                statusCode: 400,
                message: 'At least one contact field is required',
            };
        }

        try {
            const accessToken = await this.getValidHubspotAccessToken();

            if (!accessToken) {
                return {
                    message: 'HubSpot credentials not found',
                };
            }

            let targetCompanyId = body.companyId;

            // Automatic HubSpot Company lookup or creation by company name
            if (!targetCompanyId && body.company?.trim()) {
                const companyName = body.company.trim();
                const searchResponse = await findHubspotCompanyByName(
                    accessToken,
                    companyName,
                );

                if (
                    searchResponse.results &&
                    searchResponse.results.length > 0
                ) {
                    targetCompanyId = searchResponse.results[0].id;
                } else {
                    const createdCompany = await createHubspotCompany(
                        accessToken,
                        companyName,
                    );
                    targetCompanyId = createdCompany?.id;
                }
            }

            if (body.email) {
                const existingContact =
                    await findHubspotContactByEmail(
                        accessToken,
                        body.email,
                    );

                if (
                    existingContact.results &&
                    existingContact.results.length > 0
                ) {
                    const existingId =
                        existingContact.results[0].id;

                    const updatedContact = await updateHubspotContact(
                        accessToken,
                        existingId,
                        {
                            firstname: body.firstname,
                            lastname: body.lastname,
                            email: body.email,
                            phone: body.phone,
                            company: body.company,
                        },
                    );

                    if (targetCompanyId) {
                        await associateContactWithCompany(
                            accessToken,
                            existingId,
                            targetCompanyId,
                        );
                    }

                    return updatedContact;
                }
            }

            const createdContact = await createHubspotContact(
                accessToken,
                body,
                targetCompanyId,
            );

            if (targetCompanyId && createdContact?.id) {
                try {
                    await associateContactWithCompany(
                        accessToken,
                        createdContact.id,
                        targetCompanyId,
                    );
                } catch {
                    // Handled gracefully if already associated in creation payload
                }
            }

            return createdContact;
        } catch (error) {
            return handleHubspotError(error);
        }
    }
    @Post('contact')
    async getContactById(
        @Body()
        body: {
            id?: string;
        },
    ) {
        if (!body.id) {
            return {
                message: 'Contact ID is required',
            };
        }

        const accessToken =
            await this.getValidHubspotAccessToken();

        if (!accessToken) {
            return {
                message: 'HubSpot credentials not found',
            };
        }

        try {
            return await getHubspotContactById(
                accessToken,
                body.id,
            );
        } catch (error) {
            return handleHubspotError(error);
        }
    }

    @Post('contact/update')
    async updateContact(
        @Body()
        body: {
            id?: string;
            firstname?: string;
            lastname?: string;
            email?: string;
        },
    ) {
        if (!body.id) {
            return {
                message: 'Contact ID is required',
            };
        }

        const accessToken =
            await this.getValidHubspotAccessToken();

        if (!accessToken) {
            return {
                message: 'HubSpot credentials not found',
            };
        }

        try {
            return await updateHubspotContact(
                accessToken,
                body.id,
                {
                    firstname: body.firstname,
                    lastname: body.lastname,
                    email: body.email,
                },
            );
        } catch (error) {
            return handleHubspotError(error);
        }
    }
}
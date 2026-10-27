import {
    Body,
    Controller,
    Get,
    Headers as NestHeaders,
    HttpException,
    HttpStatus,
    Post,
    Query,
    Redirect,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { DealInvoiceEntity } from './entities/deal-invoice.entity';

import { handleZohoError } from './error';
import { zohoConfig } from './config';
import { zohoAction } from './action';
import { ZohoCredentialEntity } from './entities/zoho-credential.entity';

@Controller('zoho')
export class ZohoController {

    constructor(
        private readonly configService: ConfigService,

        @InjectRepository(ZohoCredentialEntity)
        private readonly credentialRepository: Repository<ZohoCredentialEntity>,

        @InjectRepository(DealInvoiceEntity)
        private readonly dealInvoiceRepository: Repository<DealInvoiceEntity>,
    ) { }


    // Centralized credential retrieval from PostgreSQL
    private async getLatestCredential(): Promise<ZohoCredentialEntity> {
        const credential = await this.credentialRepository.findOne({
            where: {},
            order: {
                id: 'DESC',
            },
        });

        if (!credential) {
            throw new HttpException(
                {
                    message: 'Zoho credentials not found',
                },
                HttpStatus.NOT_FOUND,
            );
        }

        return credential;
    }

    // Centralized access-token validation and auto-refresh
    private async getValidAccessToken(): Promise<string> {
        const credential = await this.getLatestCredential();

        const now = Date.now();
        const expiresAt = credential.expiresAt
            ? credential.expiresAt.getTime()
            : 0;

        // 1. Stored access token is still valid (not expired or about to expire)
        if (
            expiresAt &&
            expiresAt - now > 60_000
        ) {
            return credential.accessToken;
        }

        // 2. Token expired or expiry time missing -> refresh using refresh token
        const clientId =
            this.configService.get<string>('ZOHO_CLIENT_ID');
        const clientSecret =
            this.configService.get<string>('ZOHO_CLIENT_SECRET');

        const response = await axios.post(
            zohoConfig.tokenUrl,
            null,
            {
                params: {
                    refresh_token: credential.refreshToken,
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'refresh_token',
                },
            },
        );

        // 3. Update database with new token & expiry
        credential.accessToken = response.data.access_token;

        if (response.data.expires_in) {
            credential.expiresAt = new Date(
                Date.now() + Number(response.data.expires_in) * 1000,
            );
        }

        await this.credentialRepository.save(credential);

        return credential.accessToken;
    }

    // Common request execution wrapper with centralized token acquisition and error handling
    private async executeZohoRequest<T>(
        request: (accessToken: string) => Promise<T>,
        isSingleRecord: boolean = false,
    ): Promise<T> {
        try {
            const accessToken = await this.getValidAccessToken();
            const response = await request(accessToken);

            if (isSingleRecord) {
                this.validateSingleRecordResponse(response);
            }

            return response;
        } catch (error) {
            handleZohoError(error);
        }
    }

    // Reusable single-record validation to ensure non-existing IDs return 404
    private validateSingleRecordResponse(response: any): void {
        if (!response || response === '') {
            handleZohoError({
                response: {
                    status: 404,
                    data: {
                        message: 'Zoho record not found',
                    },
                },
            });
        }

        if (
            typeof response === 'object' &&
            'data' in response &&
            Array.isArray(response.data)
        ) {
            if (response.data.length === 0) {
                handleZohoError({
                    response: {
                        status: 404,
                        data: {
                            message: 'Zoho record not found',
                        },
                    },
                });
            }

            const firstItem = response.data[0];
            if (
                firstItem &&
                (firstItem.status === 'error' ||
                    firstItem.code === 'INVALID_DATA' ||
                    firstItem.code === 'INVALID_URL_PATTERN')
            ) {
                handleZohoError({
                    response: {
                        status: 404,
                        data: firstItem,
                    },
                });
            }
        }
    }

    // Zoho OAuth authorization URL
    @Get('auth')
    @Redirect()
    getAuthUrl() {
        const clientId =
            this.configService.get<string>('ZOHO_CLIENT_ID');
        const redirectUri =
            this.configService.get<string>('ZOHO_REDIRECT_URI');

        const authUrl =
            `${zohoConfig.accountsUrl}/auth` +
            `?response_type=code` +
            `&client_id=${clientId}` +

            `&scope=ZohoCRM.modules.ALL,ZohoCRM.coql.READ,ZohoInvoice.settings.READ,ZohoInvoice.invoices.CREATE,ZohoInvoice.invoices.READ,ZohoInvoice.invoices.UPDATE,ZohoInvoice.contacts.READ,ZohoInvoice.contacts.CREATE` +
            `&redirect_uri=${redirectUri}` +
            `&access_type=offline` +
            `&prompt=consent`;

        return {
            url: authUrl,
            statusCode: 302,
        };
    }

    // Zoho OAuth callback
    @Get('callback')
    async zohoCallback(@Query('code') code: string) {
        try {
            const clientId =
                this.configService.get<string>('ZOHO_CLIENT_ID');
            const clientSecret =
                this.configService.get<string>('ZOHO_CLIENT_SECRET');
            const redirectUri =
                this.configService.get<string>('ZOHO_REDIRECT_URI');

            const response = await axios.post(
                zohoConfig.tokenUrl,
                null,
                {
                    params: {
                        code,
                        client_id: clientId,
                        client_secret: clientSecret,
                        redirect_uri: redirectUri,
                        grant_type: 'authorization_code',
                    },
                },
            );

            const accessToken = response.data.access_token;
            const refreshToken = response.data.refresh_token;
            const expiresIn = Number(response.data.expires_in);

            const expiresAt = Number.isFinite(expiresIn)
                ? new Date(Date.now() + expiresIn * 1000)
                : null;

            const credential = this.credentialRepository.create({
                accessToken,
                refreshToken,
                expiresAt,
            });

            await this.credentialRepository.save(credential);

            return {
                message: 'Zoho OAuth successful',
                expiresIn,
            };
        } catch (error) {
            handleZohoError(error);
        }
    }

    // Manual refresh access token
    @Post('refresh')
    async refreshToken() {
        try {
            const credential = await this.getLatestCredential();
            const clientId =
                this.configService.get<string>('ZOHO_CLIENT_ID');
            const clientSecret =
                this.configService.get<string>('ZOHO_CLIENT_SECRET');

            const response = await axios.post(
                zohoConfig.tokenUrl,
                null,
                {
                    params: {
                        refresh_token: credential.refreshToken,
                        client_id: clientId,
                        client_secret: clientSecret,
                        grant_type: 'refresh_token',
                    },
                },
            );

            credential.accessToken = response.data.access_token;

            if (response.data.expires_in) {
                credential.expiresAt = new Date(
                    Date.now() + Number(response.data.expires_in) * 1000,
                );
            }

            await this.credentialRepository.save(credential);

            return {
                message: 'Zoho access token refreshed successfully',
                expiresIn: response.data.expires_in,
            };
        } catch (error) {
            handleZohoError(error);
        }
    }

    // Get Contacts with pagination
    @Post('contacts')
    async getContacts(
        @Query('page') page: string = '1',
        @Query('perPage') perPage: string = '10',
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.executeZohoRequest((token) =>
            zohoAction.getContacts(token, Number(page), Number(perPage), startDate, endDate),
        );
    }

    // Get Contact by ID
    @Post('contact')
    async getContactById(@Query('contactId') contactId: string) {
        return this.executeZohoRequest(
            (token) => zohoAction.getContactById(token, contactId),
            true,
        );
    }

    // Create Contact
    @Post('contact/create')
    async createContact(@Body() contactData: Record<string, any>) {
        return this.executeZohoRequest((token) =>
            zohoAction.createContact(token, contactData),
        );
    }

    // Update Contact
    @Post('contact/update')
    async updateContact(
        @Query('contactId') contactId: string,
        @Body() contactData: Record<string, any>,
    ) {
        return this.executeZohoRequest((token) =>
            zohoAction.updateContact(token, contactId, contactData),
        );
    }

    // Get Leads with pagination
    @Post('leads')
    async getLeads(
        @Query('page') page: string = '1',
        @Query('perPage') perPage: string = '10',
    ) {
        return this.executeZohoRequest((token) =>
            zohoAction.getLeads(token, Number(page), Number(perPage)),
        );
    }
    // Get Lead by ID
    @Post('lead')
    async getLeadById(@Query('leadId') leadId: string) {
        return this.executeZohoRequest(
            (token) => zohoAction.getLeadById(token, leadId),
            true,
        );
    }
    // Create Lead
    @Post('lead/create')
    async createLead(
        @Body() body: {
            First_Name?: string;
            Last_Name: string;
            Email?: string;
            Phone?: string;
            Company: string;
        },
    ) {
        return this.executeZohoRequest(
            (token) =>
                zohoAction.createLead(
                    token,
                    body,
                ),
            false,
        );
    }
    // Update Lead
    @Post('lead/update')
    async updateLead(
        @Query('leadId') leadId: string,
        @Body() body: {
            First_Name?: string;
            Last_Name?: string;
            Email?: string;
            Phone?: string;
            Company?: string;
        },
    ) {
        return this.executeZohoRequest(
            (token) =>
                zohoAction.updateLead(
                    token,
                    leadId,
                    body,
                ),
            false,
        );
    }

    // Get Accounts with pagination
    @Post('accounts')
    async getAccounts(
        @Query('page') page: string = '1',
        @Query('perPage') perPage: string = '10',
    ) {
        return this.executeZohoRequest((token) =>
            zohoAction.getAccounts(token, Number(page), Number(perPage)),
        );
    }

    // Create Account
    @Post('account/create')
    async createAccount(@Body() accountData: Record<string, any>) {
        return this.executeZohoRequest((token) =>
            zohoAction.createAccount(token, accountData),
        );
    }

    // Get Account by ID
    @Post('account')
    async getAccountById(@Query('accountId') accountId: string) {
        return this.executeZohoRequest(
            (token) => zohoAction.getAccountById(token, accountId),
            true,
        );
    }

    // Update Account
    @Post('account/update')
    async updateAccount(
        @Query('accountId') accountId: string,
        @Body() accountData: Record<string, any>,
    ) {
        return this.executeZohoRequest((token) =>
            zohoAction.updateAccount(token, accountId, accountData),
        );
    }
    // get all deals
    @Post('deals')
    async getDeals(
        @Query('page') page: string = '1',
        @Query('perPage') perPage: string = '10',
    ) {
        return this.executeZohoRequest((token) =>
            zohoAction.getDeals(
                token,
                Number(page),
                Number(perPage),
            ),
        );
    }
    // get deals by id
    @Post('deal')
    async getDealById(@Query('dealId') dealId: string) {
        return this.executeZohoRequest(
            (token) => zohoAction.getDealById(token, dealId),
            true,
        );
    }
// Create deal
    @Post('deal/create')
    async createDeal(
        @Body() dealData: Record<string, any>,
    ) {
        return this.executeZohoRequest((token) =>
            zohoAction.createDeal(token, dealData),
        );
    }
    @Post('webhook/deal-closed-won')
    async handleDealClosedWonWebhook(
        @NestHeaders('x-webhook-secret') webhookSecret: string,
        @Body() body: { dealId?: string },
    ) {
        const expectedSecret = this.configService.get<string>(
            'ZOHO_WEBHOOK_SECRET',
        );

        if (!expectedSecret || webhookSecret !== expectedSecret) {
            throw new UnauthorizedException('Invalid webhook secret');
        }

        if (!body?.dealId) {
            throw new BadRequestException('dealId is required');
        }

        return this.executeZohoRequest(async (token) => {
            const dealResponse = await zohoAction.getDealById(
                token,
                body.dealId!,
            );

            const deal = dealResponse?.data?.[0];

            if (!deal) {
                throw new BadRequestException('Deal not found in Zoho CRM');
            }

            if (deal.Stage !== 'Closed Won') {
                return {
                    invoiceCreated: false,
                    message: `Deal stage is ${deal.Stage}. No invoice created.`,
                };
            }

            return {
                invoiceCreated: false,
                message:
                    'Webhook received and Deal verified. Invoice creation will be connected in the next step.',
                dealId: body.dealId,
                dealName: deal.Deal_Name,
            };
        });
    }


    @Post('deal/update')
    async updateDeal(
        @Query('dealId') dealId: string,
        @Body() dealData: Record<string, any>,
    ) {
        return this.executeZohoRequest(async (token) => {
            // 1. Update the CRM Deal
            const updateResult = await zohoAction.updateDeal(
                token,
                dealId,
                dealData,
            );

            // 2. Fetch the updated Deal
            const dealResponse = await zohoAction.getDealById(
                token,
                dealId,
            );

            const deal = dealResponse?.data?.[0];

            if (!deal) {
                return {
                    updateResult,
                    invoiceCreated: false,
                    message: 'Updated Deal details were not returned.',
                };
            }

            // 3. Check Deal stage
            if (deal.Stage !== 'Closed Won') {
                return {
                    updateResult,
                    invoiceCreated: false,
                    message: `Deal stage is ${deal.Stage}. No invoice created.`,
                };
            }

            // 4. Check existing mapping
            const existingMapping = await this.dealInvoiceRepository.findOne({
                where: { dealId },
            });

            if (existingMapping) {
                return {
                    updateResult,
                    invoiceCreated: false,
                    message: `Invoice automation already processed. Status: ${existingMapping.status}`,
                    invoiceId: existingMapping.invoiceId,
                    invoiceNumber: existingMapping.invoiceNumber,
                };
            }

            // 5. Validate Deal amount
            if (!deal.Amount || Number(deal.Amount) <= 0) {
                return {
                    updateResult,
                    invoiceCreated: false,
                    message: 'Deal amount is missing or invalid.',
                };
            }

            // 6. Reserve this Deal in the database
            const mapping = this.dealInvoiceRepository.create({
                dealId,
                status: 'IN_PROGRESS',
            });

            await this.dealInvoiceRepository.save(mapping);

            try {
                // 7. Create Zoho Invoice
                const invoiceResult = await zohoAction.createInvoice(
                    token,
                    '60091367125',
                    {
                        customer_id: '4278225000000034193',
                        reference_number: dealId,
                        date: new Date().toISOString().slice(0, 10),
                        line_items: [
                            {
                                name: deal.Deal_Name || 'CRM Deal',
                                rate: Number(deal.Amount),
                                quantity: 1,
                            },
                        ],
                    },
                );

                const invoice = invoiceResult?.invoice;

                if (!invoice?.invoice_id) {
                    throw new Error(
                        invoiceResult?.message ||
                        'Zoho Invoice did not return an invoice ID. Check the API response.',
                    );
                }

                // 8. Save invoice details in PostgreSQL
                mapping.invoiceId = invoice.invoice_id;
                mapping.invoiceNumber = invoice.invoice_number;
                mapping.status = 'SUCCESS';

                await this.dealInvoiceRepository.save(mapping);

                return {
                    updateResult,
                    invoiceCreated: true,
                    invoiceId: mapping.invoiceId,
                    invoiceNumber: mapping.invoiceNumber,
                    status: mapping.status,
                };
            } catch (error: any) {
                mapping.status = 'FAILED';
                mapping.errorMessage =
                    error.response?.data?.message ||
                    error.message ||
                    'Invoice creation failed';

                await this.dealInvoiceRepository.save(mapping);

                throw error;
            }

        });

    }


    // Zoho Invoice: Get Organizations
    @Post('invoice/organizations')
    async getInvoiceOrganizations() {
        return this.executeZohoRequest(
            (accessToken) =>
                zohoAction.getInvoiceOrganizations(accessToken),
        );
    }

    @Post('invoice/invoices')
    async getInvoices() {
        return this.executeZohoRequest(
            (accessToken) =>
                zohoAction.getInvoices(
                    accessToken,
                    '60091367125',
                ),
        );
    }

    @Post('invoice/create')
    async createInvoice(@Body() invoiceData: any) {
        return this.executeZohoRequest(
            (accessToken) =>
                zohoAction.createInvoice(
                    accessToken,
                    '60091367125',
                    invoiceData,
                ),
        );
    }

    @Post('invoice/customers')
    async getInvoiceCustomers() {
        return this.executeZohoRequest(
            (accessToken) =>
                zohoAction.getInvoiceCustomers(
                    accessToken,
                    '60091367125',
                ),
        );
    }

    @Post('invoice/customer/create')
    async createInvoiceCustomer(@Body() customerData: any) {
        return this.executeZohoRequest(
            (accessToken) =>
                zohoAction.createInvoiceCustomer(
                    accessToken,
                    '60091367125',
                    customerData,
                ),
        );
    }
}

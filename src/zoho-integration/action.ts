import axios from 'axios';
import { zohoConfig } from './config';

export function formatCoqlStartDate(startDate: string): string {
    if (!startDate) return startDate;
    const trimmed = startDate.trim();
    const datePart = trimmed.split(/[T ]/)[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return `${datePart}T00:00:00+05:30`;
    }
    return trimmed;
}

export function formatCoqlEndDate(endDate: string): string {
    if (!endDate) return endDate;
    const trimmed = endDate.trim();
    const datePart = trimmed.split(/[T ]/)[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return `${datePart}T23:59:59+05:30`;
    }
    return trimmed;
}

export const zohoAction = {
    // =========================================================
    // CONTACTS
    // =========================================================

    async getContacts(
        accessToken: string,
        page: number = 1,
        perPage: number = 10,
        startDate?: string,
        endDate?: string,
    ) {
        const response = await axios.get(
            `${zohoConfig.baseUrl}/Contacts`,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
                params: {
                    fields:
                        'First_Name,Last_Name,Email,Phone,Account_Name,Created_Time',
                    page,
                    per_page: perPage,

                    ...(startDate &&
                        endDate && {
                        criteria: `((Created_Time:greater_equal:${startDate})and(Created_Time:less_equal:${endDate}))`,
                    }),

                    ...(startDate &&
                        !endDate && {
                        criteria: `(Created_Time:greater_equal:${startDate})`,
                    }),
                },
            },
        );

        return response.data;
    },

    async getContactsByDateRange(
        accessToken: string,
        startDate: string,
        endDate: string,
        limit: number = 200,
        offset: number = 0,
    ) {
        try {
            const formattedStart = formatCoqlStartDate(startDate);
            const formattedEnd = formatCoqlEndDate(endDate);
            const query = `select id, First_Name, Last_Name, Email, Phone, Account_Name, Created_Time from Contacts where (Created_Time >= '${formattedStart}' and Created_Time <= '${formattedEnd}') limit ${limit} offset ${offset}`;

            const response = await axios.post(
                `${zohoConfig.baseUrl}/coql`,
                {
                    select_query: query,
                },
                {
                    headers: {
                        Authorization: `Zoho-oauthtoken ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            if (response.status === 204 || !response.data) {
                return {
                    data: [],
                    info: {
                        count: 0,
                        more_records: false,
                    },
                };
            }

            return response.data;
        } catch (error: any) {
            if (
                error.response?.status === 204 ||
                error.response?.data?.code === 'RECORD_NOT_FOUND' ||
                (
                    error.response?.data?.status === 'error' &&
                    error.response?.data?.code === 'INVALID_DATA'
                )
            ) {
                return {
                    data: [],
                    info: {
                        count: 0,
                        more_records: false,
                    },
                };
            }

            throw error;
        }
    },

    async getAllContactsByDateRange(
        accessToken: string,
        startDate: string,
        endDate: string,
    ) {
        let offset = 0;
        const limit = 200;
        const allContacts: any[] = [];
        let hasMore = true;

        while (hasMore) {
            const response = await this.getContactsByDateRange(
                accessToken,
                startDate,
                endDate,
                limit,
                offset,
            );

            const records = Array.isArray(response.data)
                ? response.data
                : Array.isArray(response.data?.data)
                    ? response.data.data
                    : [];

            if (records.length === 0) {
                break;
            }

            allContacts.push(...records);

            if (
                response.info &&
                response.info.more_records === false
            ) {
                hasMore = false;
            } else if (records.length < limit) {
                hasMore = false;
            } else {
                offset += records.length;
            }
        }

        return allContacts;
    },

    async getContactById(
        accessToken: string,
        contactId: string,
    ) {
        const response = await axios.get(
            `${zohoConfig.baseUrl}/Contacts/${contactId}`,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
                params: {
                    fields:
                        'First_Name,Last_Name,Email,Phone,Account_Name,Created_Time',
                },
            },
        );

        return response.data;
    },

    async createContact(
        accessToken: string,
        contactData: Record<string, any>,
    ) {
        const response = await axios.post(
            `${zohoConfig.baseUrl}/Contacts`,
            {
                data: [contactData],
            },
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
            },
        );

        return response.data;
    },

    async updateContact(
        accessToken: string,
        contactId: string,
        contactData: Record<string, any>,
    ) {
        const response = await axios.put(
            `${zohoConfig.baseUrl}/Contacts/${contactId}`,
            {
                data: [contactData],
            },
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
            },
        );

        return response.data;
    },

    async findContactByEmail(
        accessToken: string,
        email: string,
    ) {
        try {
            const response = await axios.get(
                `${zohoConfig.baseUrl}/Contacts/search`,
                {
                    headers: {
                        Authorization: `Zoho-oauthtoken ${accessToken}`,
                    },
                    params: {
                        criteria: `((Email:equals:${email}))`,
                    },
                },
            );

            if (response.status === 204 || !response.data) {
                return { data: [] };
            }

            return response.data;
        } catch (error: any) {
            if (
                error.response?.status === 204 ||
                error.response?.data?.code === 'RECORD_NOT_FOUND' ||
                (
                    error.response?.data?.status === 'error' &&
                    error.response?.data?.code === 'INVALID_DATA'
                )
            ) {
                return { data: [] };
            }

            throw error;
        }
    },

    // =========================================================
    // LEADS
    // =========================================================

    async getLeads(
        accessToken: string,
        page: number = 1,
        perPage: number = 10,
    ) {
        const response = await axios.get(
            `${zohoConfig.baseUrl}/Leads`,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
                params: {
                    fields:
                        'First_Name,Last_Name,Email,Phone,Company',
                    page,
                    per_page: perPage,
                },
            },
        );

        return response.data;
    },

    async getLeadById(
        accessToken: string,
        leadId: string,
    ) {
        const response = await axios.get(
            `${zohoConfig.baseUrl}/Leads/${leadId}`,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
                params: {
                    fields:
                        'First_Name,Last_Name,Email,Phone,Company',
                },
            },
        );

        return response.data;
    },

    async createLead(
        accessToken: string,
        leadData: Record<string, any>,
    ) {
        const response = await axios.post(
            `${zohoConfig.baseUrl}/Leads`,
            {
                data: [leadData],
            },
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
            },
        );

        return response.data;
    },

    async updateLead(
        accessToken: string,
        leadId: string,
        leadData: Record<string, any>,
    ) {
        const response = await axios.put(
            `${zohoConfig.baseUrl}/Leads/${leadId}`,
            {
                data: [leadData],
            },
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
            },
        );

        return response.data;
    },

    // =========================================================
    // LEAD DATE-RANGE MIGRATION
    // =========================================================

    async getLeadsByDateRange(
        accessToken: string,
        startDate: string,
        endDate: string,
        limit: number = 200,
        offset: number = 0,
    ) {
        try {
            const formattedStart = formatCoqlStartDate(startDate);
            const formattedEnd = formatCoqlEndDate(endDate);
            const query = `
                select id, First_Name, Last_Name, Email, Phone, Company, Created_Time
                from Leads
                where (
                    Created_Time >= '${formattedStart}'
                    and Created_Time <= '${formattedEnd}'
                )
                limit ${limit}
                offset ${offset}
            `;

            const response = await axios.post(
                `${zohoConfig.baseUrl}/coql`,
                {
                    select_query: query,
                },
                {
                    headers: {
                        Authorization: `Zoho-oauthtoken ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            if (response.status === 204 || !response.data) {
                return {
                    data: [],
                    info: {
                        count: 0,
                        more_records: false,
                    },
                };
            }

            return response.data;
        } catch (error: any) {
            if (
                error.response?.status === 204 ||
                error.response?.data?.code === 'RECORD_NOT_FOUND' ||
                (
                    error.response?.data?.status === 'error' &&
                    error.response?.data?.code === 'INVALID_DATA'
                )
            ) {
                return {
                    data: [],
                    info: {
                        count: 0,
                        more_records: false,
                    },
                };
            }

            throw error;
        }
    },

    async getAllLeadsByDateRange(
        accessToken: string,
        startDate: string,
        endDate: string,
    ) {
        let offset = 0;
        const limit = 200;
        const allLeads: any[] = [];
        let hasMore = true;

        while (hasMore) {
            const response = await this.getLeadsByDateRange(
                accessToken,
                startDate,
                endDate,
                limit,
                offset,
            );

            const records = Array.isArray(response.data)
                ? response.data
                : Array.isArray(response.data?.data)
                    ? response.data.data
                    : [];

            if (records.length === 0) {
                break;
            }

            allLeads.push(...records);

            if (
                response.info &&
                response.info.more_records === false
            ) {
                hasMore = false;
            } else if (records.length < limit) {
                hasMore = false;
            } else {
                offset += records.length;
            }
        }

        return allLeads;
    },

    // =========================================================
    // ACCOUNTS
    // =========================================================

    async getAccounts(
        accessToken: string,
        page: number = 1,
        perPage: number = 10,
    ) {
        const response = await axios.get(
            `${zohoConfig.baseUrl}/Accounts`,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
                params: {
                    fields:
                        'Account_Name,Phone,Website,Industry',
                    page,
                    per_page: perPage,
                },
            },
        );

        return response.data;
    },

    async getAccountById(
        accessToken: string,
        accountId: string,
    ) {
        const response = await axios.get(
            `${zohoConfig.baseUrl}/Accounts/${accountId}`,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
                params: {
                    fields:
                        'Account_Name,Phone,Website,Industry',
                },
            },
        );

        return response.data;
    },

    async createAccount(
        accessToken: string,
        accountData: Record<string, any>,
    ) {
        const response = await axios.post(
            `${zohoConfig.baseUrl}/Accounts`,
            {
                data: [accountData],
            },
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
            },
        );

        return response.data;
    },


    // =========================================================
    // FIND ACCOUNT BY NAME
    // =========================================================

    async findAccountByName(
        accessToken: string,
        accountName: string,
    ) {
        try {
            const response = await axios.get(
                `${zohoConfig.baseUrl}/Accounts/search`,
                {
                    headers: {
                        Authorization: `Zoho-oauthtoken ${accessToken}`,
                    },
                    params: {
                        criteria: `((Account_Name:equals:${accountName}))`,
                    },
                },
            );

            if (response.status === 204 || !response.data) {
                return { data: [] };
            }

            return response.data;
        } catch (error: any) {
            if (
                error.response?.status === 204 ||
                error.response?.data?.code === 'RECORD_NOT_FOUND' ||
                (
                    error.response?.data?.status === 'error' &&
                    error.response?.data?.code === 'INVALID_DATA'
                )
            ) {
                return { data: [] };
            }

            throw error;
        }
    },

    async updateAccount(
        accessToken: string,
        accountId: string,
        accountData: Record<string, any>,
    ) {
        const response = await axios.put(
            `${zohoConfig.baseUrl}/Accounts/${accountId}`,
            {
                data: [accountData],
            },
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
            },
        );

        return response.data;
    },

    // =========================================================
    // ACCOUNT DATE-RANGE MIGRATION
    // =========================================================

    async getAccountsByDateRange(
        accessToken: string,
        startDate: string,
        endDate: string,
        limit: number = 200,
        offset: number = 0,
    ) {
        try {
            const formattedStart = formatCoqlStartDate(startDate);
            const formattedEnd = formatCoqlEndDate(endDate);
            const query = `
                    select id, Account_Name, Phone, Website, Industry, Created_Time
                    from Accounts
                    where (
                        Created_Time >= '${formattedStart}'
                        and Created_Time <= '${formattedEnd}'
                    )
                    limit ${limit}
                    offset ${offset}
                `;

            const response = await axios.post(
                `${zohoConfig.baseUrl}/coql`,
                {
                    select_query: query,
                },
                {
                    headers: {
                        Authorization: `Zoho-oauthtoken ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            if (response.status === 204 || !response.data) {
                return {
                    data: [],
                    info: {
                        count: 0,
                        more_records: false,
                    },
                };
            }

            return response.data;
        } catch (error: any) {
            if (
                error.response?.status === 204 ||
                error.response?.data?.code === 'RECORD_NOT_FOUND' ||
                (
                    error.response?.data?.status === 'error' &&
                    error.response?.data?.code === 'INVALID_DATA'
                )
            ) {
                return {
                    data: [],
                    info: {
                        count: 0,
                        more_records: false,
                    },
                };
            }

            throw error;
        }
    },

    async getAllAccountsByDateRange(
        accessToken: string,
        startDate: string,
        endDate: string,
    ) {
        let offset = 0;
        const limit = 200;
        const allAccounts: any[] = [];
        let hasMore = true;

        while (hasMore) {
            const response =
                await this.getAccountsByDateRange(
                    accessToken,
                    startDate,
                    endDate,
                    limit,
                    offset,
                );

            const records = Array.isArray(response.data)
                ? response.data
                : Array.isArray(response.data?.data)
                    ? response.data.data
                    : [];

            if (records.length === 0) {

                break;
            }

            allAccounts.push(...records);

            if (
                response.info &&
                response.info.more_records === false
            ) {
                hasMore = false;
            } else if (records.length < limit) {
                hasMore = false;
            } else {
                offset += records.length;
            }
        }

        return allAccounts;
    },
    // =========================================================
    // DEALS
    // =========================================================

    async getDeals(
        accessToken: string,
        page: number = 1,
        perPage: number = 10,
    ) {
        const response = await axios.get(
            `${zohoConfig.baseUrl}/Deals`,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
                params: {
                    fields:
                        'Deal_Name,Stage,Amount,Closing_Date,Account_Name,Contact_Name,Created_Time',
                    page,
                    per_page: perPage,
                },
            },
        );

        return response.data;
    },
    async getDealById(
        accessToken: string,
        dealId: string,
    ) {
        const response = await axios.get(
            `${zohoConfig.baseUrl}/Deals/${dealId}`,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
                params: {
                    fields:
                        'Deal_Name,Stage,Amount,Closing_Date,Account_Name,Contact_Name,Created_Time',
                },
            },
        );

        return response.data;
    },
    async createDeal(
        accessToken: string,
        dealData: Record<string, any>,
    ) {
        const response = await axios.post(
            `${zohoConfig.baseUrl}/Deals`,
            {
                data: [dealData],
            },
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
            },
        );

        return response.data;
    },
    async findDealByName(
        accessToken: string,
        dealName: string,
    ) {
        try {
            const response = await axios.get(
                `${zohoConfig.baseUrl}/Deals/search`,
                {
                    headers: {
                        Authorization: `Zoho-oauthtoken ${accessToken}`,
                    },
                    params: {
                        criteria: `((Deal_Name:equals:${dealName}))`,
                    },
                },
            );

            if (response.status === 204 || !response.data) {
                return { data: [] };
            }

            return response.data;
        } catch (error: any) {
            if (
                error.response?.status === 204 ||
                error.response?.data?.code === 'RECORD_NOT_FOUND' ||
                (
                    error.response?.data?.status === 'error' &&
                    error.response?.data?.code === 'INVALID_DATA'
                )
            ) {
                return { data: [] };
            }

            throw error;
        }
    },
    async updateDeal(
        accessToken: string,
        dealId: string,
        dealData: Record<string, any>,
    ) {
        const response = await axios.put(
            `${zohoConfig.baseUrl}/Deals/${dealId}`,
            {
                data: [dealData],
            },
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
            },
        );

        return response.data;
    },
    // =========================================================
    // DEAL DATE-RANGE MIGRATION
    // =========================================================

    async getDealsByDateRange(
        accessToken: string,
        startDate: string,
        endDate: string,
        limit: number = 200,
        offset: number = 0,
    ) {
        try {
            const formattedStart = formatCoqlStartDate(startDate);
            const formattedEnd = formatCoqlEndDate(endDate);
            const query = `
                select id, Deal_Name, Stage, Amount, Closing_Date,
                Account_Name, Contact_Name, Created_Time
                from Deals
                where (
                    Created_Time >= '${formattedStart}'
                    and Created_Time <= '${formattedEnd}'
                )
                limit ${limit}
                offset ${offset}
            `;

            const response = await axios.post(
                `${zohoConfig.baseUrl}/coql`,
                {
                    select_query: query,
                },
                {
                    headers: {
                        Authorization: `Zoho-oauthtoken ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            if (response.status === 204 || !response.data) {
                return {
                    data: [],
                    info: {
                        count: 0,
                        more_records: false,
                    },
                };
            }

            return response.data;
        } catch (error: any) {
            if (
                error.response?.status === 204 ||
                error.response?.data?.code === 'RECORD_NOT_FOUND' ||
                (
                    error.response?.data?.status === 'error' &&
                    error.response?.data?.code === 'INVALID_DATA'
                )
            ) {
                return {
                    data: [],
                    info: {
                        count: 0,
                        more_records: false,
                    },
                };
            }

            throw error;
        }
    },

    async getAllDealsByDateRange(
        accessToken: string,
        startDate: string,
        endDate: string,
    ) {
        let offset = 0;
        const limit = 200;
        const allDeals: any[] = [];
        let hasMore = true;

        while (hasMore) {
            const response =
                await this.getDealsByDateRange(
                    accessToken,
                    startDate,
                    endDate,
                    limit,
                    offset,
                );

            const records = Array.isArray(response.data)
                ? response.data
                : Array.isArray(response.data?.data)
                    ? response.data.data
                    : [];

            if (records.length === 0) {
                break;
            }

            allDeals.push(...records);

            if (
                response.info &&
                response.info.more_records === false
            ) {
                hasMore = false;
            } else if (records.length < limit) {
                hasMore = false;
            } else {
                offset += records.length;
            }
        }

        return allDeals;
    },

    // ZOHO INVOICE - GET ORGANIZATIONS

    async getInvoiceOrganizations(accessToken: string) {
        const response = await axios.get(
            `${zohoConfig.invoiceBaseUrl}/organizations`,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
            },
        );

        return response.data;
    },

    async getInvoices(accessToken: string, organizationId: string) {
        const response = await axios.get(
            `${zohoConfig.invoiceBaseUrl}/invoices`,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
                params: {
                    organization_id: organizationId,
                },
            },
        );

        return response.data;
    },


    async getInvoiceCustomers(
        accessToken: string,
        organizationId: string,
    ) {
        const response = await axios.get(
            `${zohoConfig.invoiceBaseUrl}/contacts`,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                    'X-com-zoho-invoice-organizationid': organizationId,
                },
                params: {
                    contact_type: 'customer',
                },
            },
        );

        return response.data;
    },

    async createInvoiceCustomer(
        accessToken: string,
        organizationId: string,
        customerData: any,
    ) {
        const response = await axios.post(
            `${zohoConfig.invoiceBaseUrl}/contacts`,
            customerData,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                    'X-com-zoho-invoice-organizationid': organizationId,
                },
            },
        );

        return response.data;
    },
    async createInvoice(
        accessToken: string,
        organizationId: string,
        invoiceData: any,
    ) {
        const response = await axios.post(
            `${zohoConfig.invoiceBaseUrl}/invoices`,
            invoiceData,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
                params: {
                    organization_id: organizationId,
                },
            },
        );

        return response.data;
    },
};
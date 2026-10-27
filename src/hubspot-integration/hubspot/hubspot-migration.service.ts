import {
    HttpException,
    HttpStatus,
    Injectable,
} from '@nestjs/common';

function isValidEmail(email?: string): boolean {
    if (!email || typeof email !== 'string') {
        return false;
    }
    const trimmed = email.trim();
    if (!trimmed) {
        return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(trimmed);
}

import { zohoAction } from '../../zoho-integration/action';

import {
    getZohoAccountName,
    mapZohoContactToHubspot,
    mapHubspotContactToZoho,
} from '../mapping/contact-mapping';

import {
    mapZohoLeadToHubspot,
} from '../mapping/lead-mapping';
import {
    mapZohoAccountToHubspot,
    mapHubspotCompanyToZoho,
} from '../mapping/account-mapping';
import {
    mapZohoDealToHubspot,
    mapHubspotDealToZoho,
} from '../mapping/deal-mapping';
import {
    createHubspotContact,
    findHubspotContactByEmail,
    updateHubspotContact,
    getHubspotContactById,
    associateContactWithCompany,
    findHubspotCompanyByName,
    createHubspotCompany,
    updateHubspotCompany,
    getHubspotCompanyById,
    getContactCompanyAssociations,
    removeContactFromCompany,
    getAllHubspotCompanies,
    getAllHubspotCompaniesByDateRange,
    createHubspotDeal,
    findHubspotDealByName,
    updateHubspotDeal,
    getHubspotDealById,
    getAllHubspotDealsByDateRange,
} from './hubspot.action';

export class HubspotMigrationService {

    // =========================================================
    // CONTACT MIGRATION
    // =========================================================

    async migrateContact(
        zohoAccessToken: string,
        hubspotAccessToken: string,
        zohoContactId: string,
    ) {
        if (!zohoAccessToken) {
            throw new HttpException('Zoho access token is missing', HttpStatus.BAD_REQUEST);
        }

        if (!hubspotAccessToken) {
            throw new HttpException('HubSpot access token is missing', HttpStatus.BAD_REQUEST);
        }

        if (!zohoContactId) {
            throw new HttpException('Zoho contact ID is missing', HttpStatus.BAD_REQUEST);
        }

        // 1. Get contact from Zoho
        let zohoResponse: any;
        try {
            zohoResponse =
                await zohoAction.getContactById(
                    zohoAccessToken,
                    zohoContactId,
                );
        } catch (error: any) {
            if (error.response?.status === 404 || error.response?.status === 204) {
                throw new HttpException('Zoho contact not found', HttpStatus.NOT_FOUND);
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Failed to fetch Zoho contact',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }

        const zohoContact =
            zohoResponse?.data?.[0];

        if (!zohoContact) {
            throw new HttpException('Zoho contact not found', HttpStatus.NOT_FOUND);
        }

        // 2. Map Zoho contact to HubSpot contact
        const hubspotContact =
            mapZohoContactToHubspot(
                zohoContact,
            );

        // 3. Find or create HubSpot company from Zoho Account
        let hubspotCompanyId: string | undefined;
        const companyName =
            getZohoAccountName(zohoContact);

        if (companyName) {
            try {
                const companyResponse =
                    await findHubspotCompanyByName(
                        hubspotAccessToken,
                        companyName,
                    );

                if (
                    companyResponse.results &&
                    companyResponse.results.length > 0
                ) {
                    // Company already exists in HubSpot
                    hubspotCompanyId =
                        companyResponse.results[0].id;
                } else {
                    // Company does not exist → create it
                    const createdCompany =
                        await createHubspotCompany(
                            hubspotAccessToken,
                            companyName,
                        );

                    if (
                        !createdCompany ||
                        !createdCompany.id
                    ) {
                        throw new Error(
                            `Failed to create HubSpot company '${companyName}': No company ID returned from HubSpot API`,
                        );
                    }

                    hubspotCompanyId =
                        createdCompany.id;
                }
            } catch (error: any) {
                const errorDetails =
                    error.response?.data
                        ? JSON.stringify(
                            error.response.data,
                        )
                        : error.message;

                throw new Error(
                    `HubSpot Company processing failed for '${companyName}': ${errorDetails}`,
                );
            }
        }

        // 4. Find existing HubSpot contact by email
        if (hubspotContact.email) {
            const existingContact =
                await findHubspotContactByEmail(
                    hubspotAccessToken,
                    hubspotContact.email,
                );

            // 5. Existing contact found → update
            if (
                existingContact.results &&
                existingContact.results.length > 0
            ) {
                const hubspotContactId =
                    existingContact.results[0].id;

                const updatedContact =
                    await updateHubspotContact(
                        hubspotAccessToken,
                        hubspotContactId,
                        hubspotContact,
                    );

                // 6. Handle company association
                if (hubspotCompanyId) {
                    try {
                        const existingAssociations =
                            await getContactCompanyAssociations(
                                hubspotAccessToken,
                                hubspotContactId,
                            );

                        const existingCompanyIds =
                            existingAssociations.results?.map(
                                (association: any) =>
                                    String(
                                        association.toObjectId,
                                    ),
                            ) ?? [];

                        // Remove old/unrelated company associations
                        for (
                            const existingCompanyId of existingCompanyIds
                        ) {
                            if (
                                existingCompanyId !==
                                String(
                                    hubspotCompanyId,
                                )
                            ) {
                                await removeContactFromCompany(
                                    hubspotAccessToken,
                                    hubspotContactId,
                                    existingCompanyId,
                                );
                            }
                        }

                        // Ensure correct company association
                        await associateContactWithCompany(
                            hubspotAccessToken,
                            hubspotContactId,
                            hubspotCompanyId,
                        );
                    } catch (error: any) {
                        const errorDetails =
                            error.response?.data
                                ? JSON.stringify(
                                    error.response.data,
                                )
                                : error.message;

                        throw new Error(
                            `HubSpot Contact-Company association failed for Contact ID '${hubspotContactId}' and Company ID '${hubspotCompanyId}': ${errorDetails}`,
                        );
                    }
                }

                return {
                    action: 'updated',
                    zohoContactId,
                    hubspotContactId,
                    data: updatedContact,
                };
            }
        }

        // 7. Contact does not exist → create
        const createdContact =
            await createHubspotContact(
                hubspotAccessToken,
                hubspotContact,
                hubspotCompanyId,
            );

        if (
            !createdContact ||
            !createdContact.id
        ) {
            throw new Error(
                'Failed to create HubSpot contact: No contact ID returned',
            );
        }

        // 8. Associate newly created contact with company
        if (hubspotCompanyId) {
            try {
                const existingAssociations =
                    await getContactCompanyAssociations(
                        hubspotAccessToken,
                        createdContact.id,
                    );

                const existingCompanyIds =
                    existingAssociations.results?.map(
                        (association: any) =>
                            String(
                                association.toObjectId,
                            ),
                    ) ?? [];

                // Remove unrelated associations
                for (
                    const existingCompanyId of existingCompanyIds
                ) {
                    if (
                        existingCompanyId !==
                        String(hubspotCompanyId)
                    ) {
                        await removeContactFromCompany(
                            hubspotAccessToken,
                            createdContact.id,
                            existingCompanyId,
                        );
                    }
                }

                await associateContactWithCompany(
                    hubspotAccessToken,
                    createdContact.id,
                    hubspotCompanyId,
                );
            } catch (error: any) {
                const errorDetails =
                    error.response?.data
                        ? JSON.stringify(
                            error.response.data,
                        )
                        : error.message;

                throw new Error(
                    `HubSpot Contact-Company association failed for Contact ID '${createdContact.id}' and Company ID '${hubspotCompanyId}': ${errorDetails}`,
                );
            }
        }

        return {
            action: 'created',
            zohoContactId,
            hubspotContactId: createdContact.id,
            data: createdContact,
        };

    }



    // =========================================================
    // DATE RANGE CONTACT MIGRATION
    // Zoho Contacts → HubSpot Contacts
    // =========================================================

    async migrateContactsByDateRange(
        zohoAccessToken: string,
        hubspotAccessToken: string,
        startDate: string,
        endDate: string,
    ) {
        if (!zohoAccessToken?.trim()) {
            throw new HttpException(
                'Zoho access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!hubspotAccessToken?.trim()) {
            throw new HttpException(
                'HubSpot access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!startDate?.trim()) {
            throw new HttpException(
                'Start date is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!endDate?.trim()) {
            throw new HttpException(
                'End date is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        const startTimestamp = new Date(startDate).getTime();
        const endTimestamp = new Date(endDate).getTime();

        if (isNaN(startTimestamp)) {
            throw new HttpException(
                'Invalid startDate format',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (isNaN(endTimestamp)) {
            throw new HttpException(
                'Invalid endDate format',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (startTimestamp > endTimestamp) {
            throw new HttpException(
                'startDate cannot be greater than endDate',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Fetch all Zoho Contacts within date range using Zoho COQL
        let zohoContacts: any[] = [];
        try {
            zohoContacts =
                await zohoAction.getAllContactsByDateRange(
                    zohoAccessToken,
                    startDate,
                    endDate,
                );
        } catch (error: any) {
            throw new HttpException(
                error.response?.data?.message || error.message || 'Failed to fetch Zoho contacts by date range',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }

        let createdCount = 0;
        let updatedCount = 0;
        let failedCount = 0;
        let associatedCount = 0;
        let associationFailedCount = 0;

        const results: Array<{
            zohoContactId: string;
            email?: string | null;
            action: 'created' | 'updated';
            hubspotContactId: string;
            association: string;
            warning?: string;
        }> = [];

        const errors: Array<{
            zohoContactId?: string;
            error: string;
        }> = [];

        for (const zohoContact of zohoContacts) {
            const zohoContactId = String(
                zohoContact.id || zohoContact.Id || '',
            );

            try {
                // 1. Map Zoho Contact → HubSpot Contact
                const hubspotContact =
                    mapZohoContactToHubspot(zohoContact);

                // 2. Validate email safely
                const emailValid = isValidEmail(hubspotContact.email);
                if (!emailValid) {
                    hubspotContact.email = undefined;
                }

                // 3. Find HubSpot Company from Zoho Account
                let hubspotCompanyId: string | undefined;
                let associationStatus = 'none';
                let companyWarning: string | undefined;

                const companyName =
                    getZohoAccountName(zohoContact);

                if (companyName) {
                    try {
                        const companyResponse =
                            await findHubspotCompanyByName(
                                hubspotAccessToken,
                                companyName,
                            );

                        if (
                            companyResponse.results &&
                            companyResponse.results.length > 0
                        ) {
                            hubspotCompanyId =
                                companyResponse.results[0].id;
                        } else {
                            associationStatus = 'company_not_found';
                            companyWarning = `Company '${companyName}' not found in HubSpot`;
                            associationFailedCount++;
                        }
                    } catch (compErr: any) {
                        const compErrorDetails =
                            compErr.response?.data
                                ? JSON.stringify(compErr.response.data)
                                : compErr.message;
                        associationStatus = 'association_failed';
                        companyWarning = `HubSpot Company lookup failed for '${companyName}': ${compErrorDetails}`;
                        associationFailedCount++;
                    }
                }

                // 4. Check if Contact exists in HubSpot (by email if valid)
                let existingHubspotContactId: string | undefined;
                if (emailValid && hubspotContact.email) {
                    const existingContactRes =
                        await findHubspotContactByEmail(
                            hubspotAccessToken,
                            hubspotContact.email,
                        );

                    if (
                        existingContactRes.results &&
                        existingContactRes.results.length > 0
                    ) {
                        existingHubspotContactId =
                            existingContactRes.results[0].id;
                    }
                }

                let hubspotContactId: string;
                let action: 'created' | 'updated';

                if (existingHubspotContactId) {
                    // Update existing contact
                    await updateHubspotContact(
                        hubspotAccessToken,
                        existingHubspotContactId,
                        hubspotContact,
                    );
                    hubspotContactId = existingHubspotContactId;
                    action = 'updated';
                    updatedCount++;
                } else {
                    // Create new contact
                    const createdContact =
                        await createHubspotContact(
                            hubspotAccessToken,
                            hubspotContact,
                            hubspotCompanyId,
                        );

                    if (
                        !createdContact ||
                        !createdContact.id
                    ) {
                        throw new Error(
                            'Failed to create HubSpot contact: No contact ID returned',
                        );
                    }

                    hubspotContactId = createdContact.id;
                    action = 'created';
                    createdCount++;
                }

                // 5. Associate Contact with Company if company exists
                if (hubspotCompanyId) {
                    try {
                        const existingAssociations =
                            await getContactCompanyAssociations(
                                hubspotAccessToken,
                                hubspotContactId,
                            );

                        const existingCompanyIds =
                            existingAssociations.results?.map(
                                (assoc: any) =>
                                    String(assoc.toObjectId),
                            ) ?? [];

                        for (const existingId of existingCompanyIds) {
                            if (existingId !== String(hubspotCompanyId)) {
                                await removeContactFromCompany(
                                    hubspotAccessToken,
                                    hubspotContactId,
                                    existingId,
                                );
                            }
                        }

                        await associateContactWithCompany(
                            hubspotAccessToken,
                            hubspotContactId,
                            hubspotCompanyId,
                        );

                        associationStatus = 'associated';
                        associatedCount++;
                    } catch (assocErr: any) {
                        const assocDetails =
                            assocErr.response?.data
                                ? JSON.stringify(assocErr.response.data)
                                : assocErr.message;
                        associationStatus = 'association_failed';
                        companyWarning = `HubSpot Contact-Company association failed: ${assocDetails}`;
                        associationFailedCount++;
                    }
                }

                results.push({
                    zohoContactId,
                    email: hubspotContact.email || null,
                    action,
                    hubspotContactId,
                    association: associationStatus,
                    ...(companyWarning ? { warning: companyWarning } : {}),
                });
            } catch (error: any) {
                failedCount++;
                const errorMessage =
                    error.response?.data
                        ? JSON.stringify(error.response.data)
                        : error.message || 'Unknown error';

                errors.push({
                    zohoContactId,
                    error: errorMessage,
                });
            }
        }

        return {
            startDate,
            endDate,
            totalFound: zohoContacts.length,
            created: createdCount,
            updated: updatedCount,
            failed: failedCount,
            associated: associatedCount,
            associationFailed: associationFailedCount,
            results,
            errors,
        };
    }

    // ========================================================
    // LEAD MIGRATION
    // Zoho Lead → HubSpot Contact
    // =========================================================

    async migrateLead(
        zohoAccessToken: string,
        hubspotAccessToken: string,
        zohoLeadId: string,
    ) {
        if (!zohoAccessToken) {
            throw new HttpException(
                'Zoho access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!hubspotAccessToken) {
            throw new HttpException(
                'HubSpot access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!zohoLeadId) {
            throw new HttpException(
                'Zoho lead ID is missing',
                HttpStatus.BAD_REQUEST,
            );
        }


        // 1. Get Lead from Zoho
        let zohoResponse: any;
        try {
            zohoResponse =
                await zohoAction.getLeadById(
                    zohoAccessToken,
                    zohoLeadId,
                );
        } catch (error: any) {
            if (error.response?.status === 404 || error.response?.status === 204) {
                throw new HttpException('Zoho lead not found', HttpStatus.NOT_FOUND);
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Failed to fetch Zoho lead',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }

        const zohoLead =
            zohoResponse?.data?.[0];

        if (!zohoLead) {
            throw new HttpException(
                'Zoho lead not found',
                HttpStatus.NOT_FOUND,
            );
        }

        // 2. Map Zoho Lead to HubSpot Contact
        const hubspotContact =
            mapZohoLeadToHubspot(
                zohoLead,
            );

        // 3. Find or create HubSpot Company
        let hubspotCompanyId: string | undefined;

        const companyName =
            zohoLead.Company?.trim();

        if (companyName) {
            try {
                const companyResponse =
                    await findHubspotCompanyByName(
                        hubspotAccessToken,
                        companyName,
                    );

                if (
                    companyResponse.results &&
                    companyResponse.results.length > 0
                ) {
                    // Company already exists
                    hubspotCompanyId =
                        companyResponse.results[0].id;
                } else {
                    // Company does not exist → create
                    const createdCompany =
                        await createHubspotCompany(
                            hubspotAccessToken,
                            companyName,
                        );

                    if (
                        !createdCompany ||
                        !createdCompany.id
                    ) {
                        throw new Error(
                            `Failed to create HubSpot company '${companyName}'`,
                        );
                    }

                    hubspotCompanyId =
                        createdCompany.id;
                }
            } catch (error: any) {
                const errorDetails =
                    error.response?.data
                        ? JSON.stringify(
                            error.response.data,
                        )
                        : error.message;

                throw new Error(
                    `HubSpot Company processing failed for '${companyName}': ${errorDetails}`,
                );
            }
        }

        // 4. Find existing HubSpot Contact by email
        if (hubspotContact.email) {
            const existingContact =
                await findHubspotContactByEmail(
                    hubspotAccessToken,
                    hubspotContact.email,
                );

            // 5. Existing Contact → Update
            if (
                existingContact.results &&
                existingContact.results.length > 0
            ) {
                const hubspotContactId =
                    existingContact.results[0].id;

                const updatedContact =
                    await updateHubspotContact(
                        hubspotAccessToken,
                        hubspotContactId,
                        hubspotContact,
                    );

                // 6. Handle Company association
                if (hubspotCompanyId) {
                    try {
                        const existingAssociations =
                            await getContactCompanyAssociations(
                                hubspotAccessToken,
                                hubspotContactId,
                            );

                        const existingCompanyIds =
                            existingAssociations.results?.map(
                                (association: any) =>
                                    String(
                                        association.toObjectId,
                                    ),
                            ) ?? [];

                        // Remove old/unrelated companies
                        for (
                            const existingCompanyId of existingCompanyIds
                        ) {
                            if (
                                existingCompanyId !==
                                String(
                                    hubspotCompanyId,
                                )
                            ) {
                                await removeContactFromCompany(
                                    hubspotAccessToken,
                                    hubspotContactId,
                                    existingCompanyId,
                                );
                            }
                        }

                        // Associate correct company
                        await associateContactWithCompany(
                            hubspotAccessToken,
                            hubspotContactId,
                            hubspotCompanyId,
                        );
                    } catch (error: any) {
                        const errorDetails =
                            error.response?.data
                                ? JSON.stringify(
                                    error.response.data,
                                )
                                : error.message;

                        throw new Error(
                            `HubSpot Lead Contact-Company association failed for Contact ID '${hubspotContactId}' and Company ID '${hubspotCompanyId}': ${errorDetails}`,
                        );
                    }
                }

                return {
                    action: 'updated',
                    zohoLeadId,
                    hubspotContactId,
                    data: updatedContact,
                };
            }
        }

        // 7. Lead does not exist in HubSpot → Create Contact
        const createdContact =
            await createHubspotContact(
                hubspotAccessToken,
                hubspotContact,
                hubspotCompanyId,
            );

        if (
            !createdContact ||
            !createdContact.id
        ) {
            throw new Error(
                'Failed to create HubSpot contact: No contact ID returned',
            );
        }

        // 8. Ensure Company association
        if (hubspotCompanyId) {
            try {
                const existingAssociations =
                    await getContactCompanyAssociations(
                        hubspotAccessToken,
                        createdContact.id,
                    );

                const existingCompanyIds =
                    existingAssociations.results?.map(
                        (association: any) =>
                            String(
                                association.toObjectId,
                            ),
                    ) ?? [];

                // Remove unrelated companies
                for (
                    const existingCompanyId of existingCompanyIds
                ) {
                    if (
                        existingCompanyId !==
                        String(hubspotCompanyId)
                    ) {
                        await removeContactFromCompany(
                            hubspotAccessToken,
                            createdContact.id,
                            existingCompanyId,
                        );
                    }
                }

                // Associate correct company
                await associateContactWithCompany(
                    hubspotAccessToken,
                    createdContact.id,
                    hubspotCompanyId,
                );
            } catch (error: any) {
                const errorDetails =
                    error.response?.data
                        ? JSON.stringify(
                            error.response.data,
                        )
                        : error.message;

                throw new Error(
                    `HubSpot Lead Contact-Company association failed for Contact ID '${createdContact.id}' and Company ID '${hubspotCompanyId}': ${errorDetails}`,
                );
            }
        }

        return {
            action: 'created',
            zohoLeadId,
            hubspotContactId:
                createdContact.id,
            data: createdContact,
        };
    }

    // =========================================================
    // DATE RANGE LEAD MIGRATION
    // Zoho Leads → HubSpot Contacts
    // =========================================================

    async migrateLeadsByDateRange(
        zohoAccessToken: string,
        hubspotAccessToken: string,
        startDate: string,
        endDate: string,
    ) {
        if (!zohoAccessToken?.trim()) {
            throw new HttpException(
                'Zoho access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!hubspotAccessToken?.trim()) {
            throw new HttpException(
                'HubSpot access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!startDate?.trim()) {
            throw new HttpException(
                'Start date is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!endDate?.trim()) {
            throw new HttpException(
                'End date is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        const startTimestamp = new Date(startDate).getTime();
        const endTimestamp = new Date(endDate).getTime();

        if (isNaN(startTimestamp)) {
            throw new HttpException(
                'Invalid startDate format',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (isNaN(endTimestamp)) {
            throw new HttpException(
                'Invalid endDate format',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (startTimestamp > endTimestamp) {
            throw new HttpException(
                'startDate cannot be greater than endDate',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Fetch all Zoho Leads within date range
        let zohoLeads: any[] = [];
        try {
            zohoLeads =
                await zohoAction.getAllLeadsByDateRange(
                    zohoAccessToken,
                    startDate,
                    endDate,
                );
        } catch (error: any) {
            throw new HttpException(
                error.response?.data?.message || error.message || 'Failed to fetch Zoho leads by date range',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }

        let createdCount = 0;
        let updatedCount = 0;
        let failedCount = 0;
        let associatedCount = 0;
        let associationFailedCount = 0;

        const results: Array<{
            zohoLeadId: string;
            email?: string | null;
            action: 'created' | 'updated';
            hubspotContactId: string;
            association: string;
            warning?: string;
        }> = [];

        const errors: Array<{
            zohoLeadId?: string;
            error: string;
        }> = [];

        for (const zohoLead of zohoLeads) {
            const zohoLeadId = String(
                zohoLead.id || zohoLead.Id || '',
            );

            try {
                // 1. Map Zoho Lead → HubSpot Contact
                const hubspotContact =
                    mapZohoLeadToHubspot(zohoLead);

                // 2. Validate email safely
                const emailValid =
                    isValidEmail(hubspotContact.email);

                if (!emailValid) {
                    hubspotContact.email = undefined;
                }

                // 3. Find HubSpot Company
                let hubspotCompanyId: string | undefined;
                let associationStatus = 'none';
                let companyWarning: string | undefined;

                const companyName =
                    zohoLead.Company?.trim();

                if (companyName) {
                    try {
                        const companyResponse =
                            await findHubspotCompanyByName(
                                hubspotAccessToken,
                                companyName,
                            );

                        if (
                            companyResponse.results &&
                            companyResponse.results.length > 0
                        ) {
                            hubspotCompanyId =
                                companyResponse.results[0].id;
                        } else {
                            associationStatus =
                                'company_not_found';

                            companyWarning =
                                `Company '${companyName}' not found in HubSpot`;

                            associationFailedCount++;
                        }
                    } catch (compErr: any) {
                        const compErrorDetails =
                            compErr.response?.data
                                ? JSON.stringify(
                                    compErr.response.data,
                                )
                                : compErr.message;

                        associationStatus =
                            'association_failed';

                        companyWarning =
                            `HubSpot Company lookup failed for '${companyName}': ${compErrorDetails}`;

                        associationFailedCount++;
                    }
                }

                // 4. Find existing HubSpot Contact by email
                let existingHubspotContactId:
                    string | undefined;

                if (
                    emailValid &&
                    hubspotContact.email
                ) {
                    const existingContactRes =
                        await findHubspotContactByEmail(
                            hubspotAccessToken,
                            hubspotContact.email,
                        );

                    if (
                        existingContactRes.results &&
                        existingContactRes.results.length > 0
                    ) {
                        existingHubspotContactId =
                            existingContactRes.results[0].id;
                    }
                }

                let hubspotContactId: string;
                let action: 'created' | 'updated';

                // 5. Update existing contact
                if (existingHubspotContactId) {
                    await updateHubspotContact(
                        hubspotAccessToken,
                        existingHubspotContactId,
                        hubspotContact,
                    );

                    hubspotContactId =
                        existingHubspotContactId;

                    action = 'updated';
                    updatedCount++;
                } else {
                    // 6. Create new contact
                    const createdContact =
                        await createHubspotContact(
                            hubspotAccessToken,
                            hubspotContact,
                            hubspotCompanyId,
                        );

                    if (
                        !createdContact ||
                        !createdContact.id
                    ) {
                        throw new Error(
                            'Failed to create HubSpot contact: No contact ID returned',
                        );
                    }

                    hubspotContactId =
                        createdContact.id;

                    action = 'created';
                    createdCount++;
                }

                // 7. Associate Contact with Company
                if (hubspotCompanyId) {
                    try {
                        const existingAssociations =
                            await getContactCompanyAssociations(
                                hubspotAccessToken,
                                hubspotContactId,
                            );

                        const existingCompanyIds =
                            existingAssociations.results?.map(
                                (assoc: any) =>
                                    String(
                                        assoc.toObjectId,
                                    ),
                            ) ?? [];

                        // Remove unrelated companies
                        for (
                            const existingId of existingCompanyIds
                        ) {
                            if (
                                existingId !==
                                String(
                                    hubspotCompanyId,
                                )
                            ) {
                                await removeContactFromCompany(
                                    hubspotAccessToken,
                                    hubspotContactId,
                                    existingId,
                                );
                            }
                        }

                        // Associate correct company
                        await associateContactWithCompany(
                            hubspotAccessToken,
                            hubspotContactId,
                            hubspotCompanyId,
                        );

                        associationStatus =
                            'associated';

                        associatedCount++;
                    } catch (assocErr: any) {
                        const assocDetails =
                            assocErr.response?.data
                                ? JSON.stringify(
                                    assocErr.response.data,
                                )
                                : assocErr.message;

                        associationStatus =
                            'association_failed';

                        companyWarning =
                            `HubSpot Contact-Company association failed: ${assocDetails}`;

                        associationFailedCount++;
                    }
                }

                results.push({
                    zohoLeadId,
                    email:
                        hubspotContact.email || null,
                    action,
                    hubspotContactId,
                    association: associationStatus,
                    ...(companyWarning
                        ? {
                            warning: companyWarning,
                        }
                        : {}),
                });
            } catch (error: any) {
                failedCount++;

                const errorMessage =
                    error.response?.data
                        ? JSON.stringify(
                            error.response.data,
                        )
                        : error.message ||
                        'Unknown error';

                errors.push({
                    zohoLeadId,
                    error: errorMessage,
                });
            }
        }

        return {
            startDate,
            endDate,
            totalFound: zohoLeads.length,
            created: createdCount,
            updated: updatedCount,
            failed: failedCount,
            associated: associatedCount,
            associationFailed:
                associationFailedCount,
            results,
            errors,
        };
    }
    // =========================================================
    // DEAL MIGRATION
    // Zoho Deal → HubSpot Deal
    // =========================================================

    async migrateDeal(
        zohoAccessToken: string,
        hubspotAccessToken: string,
        zohoDealId: string,
    ) {
        if (!zohoAccessToken?.trim()) {
            throw new HttpException(
                'Zoho access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!hubspotAccessToken?.trim()) {
            throw new HttpException(
                'HubSpot access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!zohoDealId?.trim()) {
            throw new HttpException(
                'Zoho Deal ID is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        // 1. Get Deal from Zoho
        const zohoResponse =
            await zohoAction.getDealById(
                zohoAccessToken,
                zohoDealId,
            );

        const zohoDeal =
            zohoResponse.data?.[0];

        if (!zohoDeal) {
            throw new HttpException(
                'Zoho Deal not found',
                HttpStatus.NOT_FOUND,
            );
        }

        // 2. Map Zoho Deal → HubSpot Deal
        const hubspotDeal =
            mapZohoDealToHubspot(zohoDeal);

        if (!hubspotDeal.dealname?.trim()) {
            throw new HttpException(
                'Zoho Deal Name is required',
                HttpStatus.BAD_REQUEST,
            );
        }

        // 3. Find existing HubSpot Deal
        const existingResponse =
            await findHubspotDealByName(
                hubspotAccessToken,
                hubspotDeal.dealname,
            );

        const existingDeal =
            existingResponse?.results?.[0];

        // 4. Existing Deal → Update
        if (existingDeal) {
            const updatedDeal =
                await updateHubspotDeal(
                    hubspotAccessToken,
                    existingDeal.id,
                    hubspotDeal,
                );

            return {
                action: 'updated',
                zohoDealId,
                hubspotDealId: existingDeal.id,
                data: updatedDeal,
            };
        }

        // 5. Deal does not exist → Create
        const createdDeal =
            await createHubspotDeal(
                hubspotAccessToken,
                hubspotDeal,
            );

        if (
            !createdDeal ||
            !createdDeal.id
        ) {
            throw new Error(
                'Failed to create HubSpot deal: No deal ID returned',
            );
        }

        return {
            action: 'created',
            zohoDealId,
            hubspotDealId: createdDeal.id,
            data: createdDeal,
        };
    }
    async migrateDealsByDateRange(
        zohoAccessToken: string,
        hubspotAccessToken: string,
        startDate: string,
        endDate: string,
    ) {
        if (!zohoAccessToken?.trim()) {
            throw new HttpException(
                'Zoho access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!hubspotAccessToken?.trim()) {
            throw new HttpException(
                'HubSpot access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!startDate?.trim()) {
            throw new HttpException(
                'Start date is required',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!endDate?.trim()) {
            throw new HttpException(
                'End date is required',
                HttpStatus.BAD_REQUEST,
            );
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (
            isNaN(start.getTime()) ||
            isNaN(end.getTime())
        ) {
            throw new HttpException(
                'Invalid date format',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (start > end) {
            throw new HttpException(
                'Start date cannot be greater than end date',
                HttpStatus.BAD_REQUEST,
            );
        }

        // 1. Get all Deals from Zoho within date range
        let zohoDeals: any[] = [];
        try {
            zohoDeals =
                await zohoAction.getAllDealsByDateRange(
                    zohoAccessToken,
                    startDate,
                    endDate,
                );
        } catch (error: any) {
            throw new HttpException(
                error.response?.data?.message || error.message || 'Failed to fetch Zoho deals by date range',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }

        const results: any[] = [];
        const errors: any[] = [];

        let created = 0;
        let updated = 0;
        let failed = 0;

        // 2. Migrate each Deal
        for (const zohoDeal of zohoDeals) {
            try {
                const zohoDealId = zohoDeal.id;

                if (!zohoDealId) {
                    throw new Error(
                        'Zoho Deal ID is missing',
                    );
                }

                const hubspotDeal =
                    mapZohoDealToHubspot(zohoDeal);

                if (!hubspotDeal.dealname?.trim()) {
                    throw new Error(
                        'Zoho Deal Name is required',
                    );
                }

                // 3. Find existing HubSpot Deal
                const existingResponse =
                    await findHubspotDealByName(
                        hubspotAccessToken,
                        hubspotDeal.dealname,
                    );

                const existingDeal =
                    existingResponse?.results?.[0];

                // 4. Update existing Deal
                if (existingDeal) {
                    const updatedDeal =
                        await updateHubspotDeal(
                            hubspotAccessToken,
                            existingDeal.id,
                            hubspotDeal,
                        );

                    updated++;

                    results.push({
                        action: 'updated',
                        zohoDealId,
                        hubspotDealId: existingDeal.id,
                        data: updatedDeal,
                    });

                    continue;
                }

                // 5. Create new Deal
                const createdDeal =
                    await createHubspotDeal(
                        hubspotAccessToken,
                        hubspotDeal,
                    );

                if (
                    !createdDeal ||
                    !createdDeal.id
                ) {
                    throw new Error(
                        'Failed to create HubSpot deal: No deal ID returned',
                    );
                }

                created++;

                results.push({
                    action: 'created',
                    zohoDealId,
                    hubspotDealId: createdDeal.id,
                    data: createdDeal,
                });
            } catch (error: any) {
                failed++;

                errors.push({
                    zohoDealId: zohoDeal?.id,
                    dealName: zohoDeal?.Deal_Name,
                    error:
                        error.response?.data?.message ||
                        error.message ||
                        'Unknown error',
                });
            }
        }

        return {
            startDate,
            endDate,
            totalFound: zohoDeals.length,
            created,
            updated,
            failed,
            results,
            errors,
        };
    }
    // =========================================================
    // ACCOUNT MIGRATION
    // Zoho Account → HubSpot Company
    // =========================================================

    async migrateAccount(
        zohoAccessToken: string,
        hubspotAccessToken: string,
        zohoAccountId: string,
    ) {
        if (!zohoAccessToken) {
            throw new HttpException(
                'Zoho access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!hubspotAccessToken) {
            throw new HttpException(
                'HubSpot access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!zohoAccountId) {
            throw new HttpException(
                'Zoho account ID is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        // 1. Get Account from Zoho
        let zohoResponse: any;
        try {
            zohoResponse =
                await zohoAction.getAccountById(
                    zohoAccessToken,
                    zohoAccountId,
                );
        } catch (error: any) {
            if (error.response?.status === 404 || error.response?.status === 204) {
                throw new HttpException('Zoho account not found', HttpStatus.NOT_FOUND);
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Failed to fetch Zoho account',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }

        const zohoAccount =
            zohoResponse?.data?.[0];

        if (!zohoAccount) {
            throw new HttpException(
                'Zoho account not found',
                HttpStatus.NOT_FOUND,
            );
        }

        // 2. Map Zoho Account → HubSpot Company
        const hubspotCompany =
            mapZohoAccountToHubspot(
                zohoAccount,
            );

        if (!hubspotCompany.name) {
            throw new Error(
                'Zoho account name is missing',
            );
        }

        // 3. Find existing HubSpot Company
        const existingCompany =
            await findHubspotCompanyByName(
                hubspotAccessToken,
                hubspotCompany.name,
            );

        // 4. Company exists → Update
        if (
            existingCompany.results &&
            existingCompany.results.length > 0
        ) {
            const hubspotCompanyId =
                existingCompany.results[0].id;

            const updatedCompany =
                await updateHubspotCompany(
                    hubspotAccessToken,
                    hubspotCompanyId,
                    hubspotCompany,
                );

            return {
                action: 'updated',
                zohoAccountId,
                hubspotCompanyId,
                data: updatedCompany,
            };
        }

        // 5. Company does not exist → Create
        const createdCompany =
            await createHubspotCompany(
                hubspotAccessToken,
                hubspotCompany.name,
            );

        if (
            !createdCompany ||
            !createdCompany.id
        ) {
            throw new Error(
                'Failed to create HubSpot company: No company ID returned',
            );
        }

        // 6. Update remaining company fields
        const updatedCompany =
            await updateHubspotCompany(
                hubspotAccessToken,
                createdCompany.id,
                hubspotCompany,
            );

        return {
            action: 'created',
            zohoAccountId,
            hubspotCompanyId:
                createdCompany.id,
            data: updatedCompany,
        };
    }
    // =========================================================
    // DATE RANGE ACCOUNT MIGRATION
    // Zoho Accounts → HubSpot Companies
    // =========================================================

    async migrateAccountsByDateRange(
        zohoAccessToken: string,
        hubspotAccessToken: string,
        startDate: string,
        endDate: string,
    ) {
        if (!zohoAccessToken?.trim()) {
            throw new HttpException(
                'Zoho access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!hubspotAccessToken?.trim()) {
            throw new HttpException(
                'HubSpot access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!startDate?.trim()) {
            throw new HttpException(
                'Start date is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!endDate?.trim()) {
            throw new HttpException(
                'End date is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        const startTimestamp = new Date(startDate).getTime();
        const endTimestamp = new Date(endDate).getTime();

        if (isNaN(startTimestamp)) {
            throw new HttpException(
                'Invalid startDate format',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (isNaN(endTimestamp)) {
            throw new HttpException(
                'Invalid endDate format',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (startTimestamp > endTimestamp) {
            throw new HttpException(
                'startDate cannot be greater than endDate',
                HttpStatus.BAD_REQUEST,
            );
        }

        let zohoAccounts: any[] = [];
        try {
            zohoAccounts =
                await zohoAction.getAllAccountsByDateRange(
                    zohoAccessToken,
                    startDate,
                    endDate,
                );
        } catch (error: any) {
            throw new HttpException(
                error.response?.data?.message || error.message || 'Failed to fetch Zoho accounts by date range',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }

        let createdCount = 0;
        let updatedCount = 0;
        let failedCount = 0;

        const results: Array<{
            zohoAccountId: string;
            accountName: string;
            action: 'created' | 'updated';
            hubspotCompanyId: string;
        }> = [];

        const errors: Array<{
            zohoAccountId?: string;
            error: string;
        }> = [];

        for (const zohoAccount of zohoAccounts) {
            const zohoAccountId = String(
                zohoAccount.id || zohoAccount.Id || '',
            );

            try {
                const hubspotCompany =
                    mapZohoAccountToHubspot(zohoAccount);

                if (!hubspotCompany.name) {
                    throw new Error(
                        'Zoho account name is missing',
                    );
                }

                const existingCompany =
                    await findHubspotCompanyByName(
                        hubspotAccessToken,
                        hubspotCompany.name,
                    );

                let hubspotCompanyId: string;
                let action: 'created' | 'updated';

                if (
                    existingCompany.results &&
                    existingCompany.results.length > 0
                ) {
                    hubspotCompanyId =
                        existingCompany.results[0].id;

                    await updateHubspotCompany(
                        hubspotAccessToken,
                        hubspotCompanyId,
                        hubspotCompany,
                    );

                    action = 'updated';
                    updatedCount++;
                } else {
                    const createdCompany =
                        await createHubspotCompany(
                            hubspotAccessToken,
                            hubspotCompany.name,
                        );

                    if (
                        !createdCompany ||
                        !createdCompany.id
                    ) {
                        throw new Error(
                            'Failed to create HubSpot company: No company ID returned',
                        );
                    }

                    hubspotCompanyId =
                        createdCompany.id;

                    await updateHubspotCompany(
                        hubspotAccessToken,
                        hubspotCompanyId,
                        hubspotCompany,
                    );

                    action = 'created';
                    createdCount++;
                }

                results.push({
                    zohoAccountId,
                    accountName: hubspotCompany.name,
                    action,
                    hubspotCompanyId,
                });
            } catch (error: any) {
                failedCount++;

                const errorMessage =
                    error.response?.data
                        ? JSON.stringify(error.response.data)
                        : error.message || 'Unknown error';

                errors.push({
                    zohoAccountId,
                    error: errorMessage,
                });
            }
        }

        return {
            startDate,
            endDate,
            totalFound: zohoAccounts.length,
            created: createdCount,
            updated: updatedCount,
            failed: failedCount,
            results,
            errors,
        };
    }

    async migrateHubspotContactToZoho(
        hubspotAccessToken: string,
        zohoAccessToken: string,
        hubspotContactId: string,
    ) {
        if (!hubspotAccessToken?.trim()) {
            throw new HttpException(
                'HubSpot access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!zohoAccessToken?.trim()) {
            throw new HttpException(
                'Zoho access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!hubspotContactId?.trim()) {
            throw new HttpException(
                'HubSpot contact ID is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        // 1. Get contact from HubSpot
        let hubspotContact: any;
        try {
            hubspotContact =
                await getHubspotContactById(
                    hubspotAccessToken,
                    hubspotContactId,
                );
        } catch (error: any) {
            if (error.response?.status === 404) {
                throw new HttpException(
                    'HubSpot contact not found',
                    HttpStatus.NOT_FOUND,
                );
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Failed to fetch HubSpot contact',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }

        if (!hubspotContact) {
            throw new HttpException(
                'HubSpot contact not found',
                HttpStatus.NOT_FOUND,
            );
        }

        // 2. Map HubSpot → Zoho
        const properties =
            hubspotContact.properties || hubspotContact || {};

        const zohoContact: any =
            mapHubspotContactToZoho(
                properties,
            );

        // 3. Find associated company name if available
        let companyName: string | undefined =
            (
                properties.company ||
                hubspotContact.company ||
                (typeof zohoContact.Account_Name === 'string'
                    ? zohoContact.Account_Name
                    : '')
            )?.trim();

        if (!companyName) {
            try {
                const associations =
                    await getContactCompanyAssociations(
                        hubspotAccessToken,
                        hubspotContactId,
                    );

                const associatedCompanyId =
                    associations.results?.[0]?.toObjectId;

                if (associatedCompanyId) {
                    const companyDetails =
                        await getHubspotCompanyById(
                            hubspotAccessToken,
                            String(associatedCompanyId),
                        );

                    if (companyDetails?.properties?.name?.trim()) {
                        companyName =
                            companyDetails.properties.name.trim();
                    }
                }
            } catch (assocError) {
                // If company association lookup fails or no associations found, continue
            }
        }

        // 4. Find or create Zoho Account if company name exists
        let zohoAccountId: string | undefined;

        if (companyName) {
            try {
                const searchResponse =
                    await zohoAction.findAccountByName(
                        zohoAccessToken,
                        companyName,
                    );

                const accounts = Array.isArray(searchResponse?.data)
                    ? searchResponse.data
                    : [];

                if (accounts.length > 0) {
                    const exactMatch = accounts.find(
                        (acc: any) =>
                            acc?.Account_Name?.trim().toLowerCase() ===
                            companyName!.toLowerCase(),
                    );
                    zohoAccountId = exactMatch?.id || accounts[0]?.id;
                }
            } catch (error) {
                // If search fails or not found, proceed to create
            }

            if (!zohoAccountId) {
                const createdAccount =
                    await zohoAction.createAccount(
                        zohoAccessToken,
                        {
                            Account_Name: companyName,
                        },
                    );

                zohoAccountId =
                    createdAccount?.data?.[0]?.details?.id ||
                    createdAccount?.data?.[0]?.id;
            }

            if (zohoAccountId) {
                zohoContact.Account_Name = {
                    id: zohoAccountId,
                };
            } else {
                delete zohoContact.Account_Name;
            }
        } else {
            delete zohoContact.Account_Name;
        }

        // 5. Validate email
        if (!isValidEmail(zohoContact.Email)) {
            zohoContact.Email = undefined;
        }

        // 6. Check whether contact already exists in Zoho
        let existingContact: any = null;

        if (zohoContact.Email) {
            const searchResponse =
                await zohoAction.findContactByEmail(
                    zohoAccessToken,
                    zohoContact.Email,
                );

            if (
                searchResponse?.data &&
                searchResponse.data.length > 0
            ) {
                existingContact =
                    searchResponse.data[0];
            }
        }

        // 7. Update existing contact
        if (existingContact?.id) {
            const updatedContact =
                await zohoAction.updateContact(
                    zohoAccessToken,
                    existingContact.id,
                    zohoContact,
                );

            return {
                action: 'updated',
                hubspotContactId,
                zohoContactId: existingContact.id,
                zohoAccountId: zohoAccountId ?? null,
                companyName: companyName ?? null,
                data: updatedContact,
            };
        }

        // 8. Create new contact
        const createdContact =
            await zohoAction.createContact(
                zohoAccessToken,
                zohoContact,
            );

        const zohoContactId =
            createdContact?.data?.[0]?.details?.id ||
            createdContact?.data?.[0]?.id;

        return {
            action: 'created',
            hubspotContactId,
            zohoContactId,
            zohoAccountId: zohoAccountId ?? null,
            companyName: companyName ?? null,
            data: createdContact,
        };
    }
    // =========================================================
    // REVERSE DEAL MIGRATION
    // HubSpot Deal → Zoho Deal
    // =========================================================
    async migrateHubspotDealToZoho(
        hubspotAccessToken: string,
        zohoAccessToken: string,
        hubspotDealId: string,
    ) {
        if (!hubspotAccessToken?.trim()) {
            throw new HttpException(
                'HubSpot access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!zohoAccessToken?.trim()) {
            throw new HttpException(
                'Zoho access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!hubspotDealId?.trim()) {
            throw new HttpException(
                'HubSpot deal ID is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        // 1. Get Deal from HubSpot
        let hubspotDeal: any;
        try {
            hubspotDeal =
                await getHubspotDealById(
                    hubspotAccessToken,
                    hubspotDealId.trim(),
                );
        } catch (error: any) {
            if (error.response?.status === 404) {
                throw new HttpException(
                    'HubSpot deal not found',
                    HttpStatus.NOT_FOUND,
                );
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Failed to fetch HubSpot deal',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }

        if (!hubspotDeal) {
            throw new HttpException(
                'HubSpot deal not found',
                HttpStatus.NOT_FOUND,
            );
        }

        // 2. Get HubSpot Deal properties
        const properties =
            hubspotDeal.properties || hubspotDeal || {};

        // 3. Map HubSpot Deal → Zoho Deal
        const zohoDeal =
            mapHubspotDealToZoho(properties);

        if (!zohoDeal.Deal_Name?.trim()) {
            throw new HttpException(
                'HubSpot Deal name is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        // 4. Check existing Zoho Deal by Deal Name
        let existingZohoDealId: string | undefined;

        try {
            const searchResponse =
                await zohoAction.findDealByName(
                    zohoAccessToken,
                    zohoDeal.Deal_Name,
                );

            const deals = Array.isArray(
                searchResponse?.data,
            )
                ? searchResponse.data
                : [];

            if (deals.length > 0) {
                const exactMatch = deals.find(
                    (deal: any) =>
                        deal?.Deal_Name?.trim().toLowerCase() ===
                        zohoDeal.Deal_Name.trim().toLowerCase(),
                );

                existingZohoDealId =
                    exactMatch?.id || deals[0]?.id;
            }
        } catch {
            // Search error handled gracefully
        }

        // 5. Existing Zoho Deal → Update
        if (existingZohoDealId) {
            const updatedDeal =
                await zohoAction.updateDeal(
                    zohoAccessToken,
                    existingZohoDealId,
                    zohoDeal,
                );

            return {
                action: 'updated',
                hubspotDealId: hubspotDealId.trim(),
                zohoDealId: existingZohoDealId,
                data: updatedDeal,
            };
        }

        // 6. Zoho Deal does not exist → Create
        const createdDeal =
            await zohoAction.createDeal(
                zohoAccessToken,
                zohoDeal,
            );

        const createdZohoDealId =
            createdDeal?.data?.[0]?.details?.id ||
            createdDeal?.data?.[0]?.id ||
            null;

        return {
            action: 'created',
            hubspotDealId: hubspotDealId.trim(),
            zohoDealId: createdZohoDealId,
            data: createdDeal,
        };
    }
    async migrateHubspotDealsByDateRange(
        hubspotAccessToken: string,
        zohoAccessToken: string,
        startDate: string,
        endDate: string,
    ) {
        if (!hubspotAccessToken?.trim()) {
            throw new HttpException(
                'HubSpot access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!zohoAccessToken?.trim()) {
            throw new HttpException(
                'Zoho access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!startDate?.trim()) {
            throw new HttpException(
                'Start date is required',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!endDate?.trim()) {
            throw new HttpException(
                'End date is required',
                HttpStatus.BAD_REQUEST,
            );
        }

        // 1. Get all HubSpot deals within date range
        let hubspotDeals: any[] = [];
        try {
            hubspotDeals =
                await getAllHubspotDealsByDateRange(
                    hubspotAccessToken,
                    startDate,
                    endDate,
                );
        } catch (error: any) {
            throw new HttpException(
                error.response?.data?.message || error.message || 'Failed to fetch HubSpot deals by date range',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }

        const results: any[] = [];
        const errors: any[] = [];

        let created = 0;
        let updated = 0;
        let failed = 0;

        // 2. Process each HubSpot deal
        for (const hubspotDeal of hubspotDeals) {
            try {
                const properties =
                    hubspotDeal.properties ||
                    hubspotDeal ||
                    {};

                // 3. Map HubSpot Deal → Zoho Deal
                const zohoDeal =
                    mapHubspotDealToZoho(properties);

                if (!zohoDeal.Deal_Name?.trim()) {
                    throw new Error(
                        'HubSpot Deal name is missing',
                    );
                }

                // 4. Check whether Deal already exists in Zoho
                let existingZohoDealId:
                    string | undefined;

                try {
                    const searchResponse =
                        await zohoAction.findDealByName(
                            zohoAccessToken,
                            zohoDeal.Deal_Name,
                        );

                    const deals = Array.isArray(
                        searchResponse?.data,
                    )
                        ? searchResponse.data
                        : [];

                    if (deals.length > 0) {
                        const exactMatch =
                            deals.find(
                                (deal: any) =>
                                    deal?.Deal_Name
                                        ?.trim()
                                        .toLowerCase() ===
                                    zohoDeal.Deal_Name
                                        .trim()
                                        .toLowerCase(),
                            );

                        existingZohoDealId =
                            exactMatch?.id ||
                            deals[0]?.id;
                    }
                } catch {
                    // Continue with create if search fails
                }

                // 5. Update existing Zoho Deal
                if (existingZohoDealId) {
                    const updatedDeal =
                        await zohoAction.updateDeal(
                            zohoAccessToken,
                            existingZohoDealId,
                            zohoDeal,
                        );

                    updated++;

                    results.push({
                        action: 'updated',
                        hubspotDealId:
                            hubspotDeal.id,
                        zohoDealId:
                            existingZohoDealId,
                        data: updatedDeal,
                    });

                    continue;
                }

                // 6. Create new Zoho Deal
                const createdDeal =
                    await zohoAction.createDeal(
                        zohoAccessToken,
                        zohoDeal,
                    );

                const createdZohoDealId =
                    createdDeal?.data?.[0]?.details?.id ||
                    createdDeal?.data?.[0]?.id ||
                    null;

                created++;

                results.push({
                    action: 'created',
                    hubspotDealId:
                        hubspotDeal.id,
                    zohoDealId:
                        createdZohoDealId,
                    data: createdDeal,
                });
            } catch (error: any) {
                failed++;

                errors.push({
                    hubspotDealId:
                        hubspotDeal?.id || null,
                    error:
                        error?.response?.data ||
                        error?.message ||
                        'Unknown error',
                });
            }
        }

        return {
            message:
                'HubSpot Deals migrated to Zoho successfully',
            startDate,
            endDate,
            total: hubspotDeals.length,
            created,
            updated,
            failed,
            results,
            errors,
        };
    }

    // =========================================================
    // REVERSE COMPANY MIGRATION (SINGLE)
    // HubSpot Company → Zoho Account
    // =========================================================
    async migrateHubspotCompanyToZoho(
        hubspotAccessToken: string,
        zohoAccessToken: string,
        hubspotCompanyId: string,
    ) {
        if (!hubspotAccessToken?.trim()) {
            throw new HttpException(
                'HubSpot access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!zohoAccessToken?.trim()) {
            throw new HttpException(
                'Zoho access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!hubspotCompanyId?.trim()) {
            throw new HttpException(
                'HubSpot company ID is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        // 1. Fetch specific HubSpot Company
        let company: any;
        try {
            company = await getHubspotCompanyById(
                hubspotAccessToken,
                hubspotCompanyId.trim(),
            );
        } catch (error: any) {
            if (error.response?.status === 404) {
                throw new HttpException(
                    'HubSpot company not found',
                    HttpStatus.NOT_FOUND,
                );
            }
            throw new HttpException(
                error.response?.data?.message || error.message || 'Failed to fetch HubSpot company',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }

        if (!company) {
            throw new HttpException(
                'HubSpot company not found',
                HttpStatus.NOT_FOUND,
            );
        }

        const properties =
            company.properties || company || {};
        const companyName = String(
            properties.name || '',
        ).trim();

        if (!companyName) {
            throw new HttpException(
                'HubSpot company name is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        // 2. Map HubSpot Company to Zoho Account
        const zohoAccount =
            mapHubspotCompanyToZoho(properties);

        // 3. Duplicate Check: Search Zoho Accounts by Account_Name
        let existingZohoAccountId: string | undefined;

        try {
            const searchResponse =
                await zohoAction.findAccountByName(
                    zohoAccessToken,
                    companyName,
                );

            const accounts = Array.isArray(
                searchResponse?.data,
            )
                ? searchResponse.data
                : [];

            if (accounts.length > 0) {
                const exactMatch = accounts.find(
                    (acc: any) =>
                        acc?.Account_Name?.trim().toLowerCase() ===
                        companyName.toLowerCase(),
                );
                existingZohoAccountId =
                    exactMatch?.id || accounts[0]?.id;
            }
        } catch {
            // Search error handled gracefully
        }

        // 4. Update or Create in Zoho
        if (existingZohoAccountId) {
            const updatedAccount =
                await zohoAction.updateAccount(
                    zohoAccessToken,
                    existingZohoAccountId,
                    zohoAccount,
                );

            return {
                action: 'updated',
                hubspotCompanyId:
                    hubspotCompanyId.trim(),
                companyName,
                zohoAccountId: existingZohoAccountId,
                data: updatedAccount,
            };
        }

        const createResponse =
            await zohoAction.createAccount(
                zohoAccessToken,
                zohoAccount,
            );

        const createdZohoAccountId =
            createResponse?.data?.[0]?.details?.id ||
            createResponse?.data?.[0]?.id ||
            null;

        return {
            action: 'created',
            hubspotCompanyId:
                hubspotCompanyId.trim(),
            companyName,
            zohoAccountId: createdZohoAccountId,
            data: createResponse,
        };
    }

    // =========================================================
    // REVERSE COMPANY MIGRATION (ALL)
    // HubSpot Companies → Zoho Accounts
    // =========================================================
    async migrateHubspotCompanies(
        hubspotAccessToken: string,
        zohoAccessToken: string,
    ) {
        if (!hubspotAccessToken?.trim()) {
            throw new HttpException(
                'HubSpot access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!zohoAccessToken?.trim()) {
            throw new HttpException(
                'Zoho access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        const hubspotCompanies =
            await getAllHubspotCompanies(hubspotAccessToken);

        let createdCount = 0;
        let updatedCount = 0;
        let failedCount = 0;

        const results: Array<{
            hubspotCompanyId: string;
            companyName: string;
            zohoAccountId?: string | null;
            action?: 'created' | 'updated';
            error?: string;
        }> = [];

        for (const company of hubspotCompanies) {
            const hubspotCompanyId = String(company.id || '');
            const properties =
                company.properties || company || {};
            const companyName = String(
                properties.name || '',
            ).trim();

            try {
                if (!companyName) {
                    throw new Error(
                        'HubSpot company name is missing',
                    );
                }

                const zohoAccount =
                    mapHubspotCompanyToZoho(properties);

                // Duplicate Check: Search Zoho Accounts by Account_Name
                let existingZohoAccountId: string | undefined;

                try {
                    const searchResponse =
                        await zohoAction.findAccountByName(
                            zohoAccessToken,
                            companyName,
                        );

                    const accounts = Array.isArray(
                        searchResponse?.data,
                    )
                        ? searchResponse.data
                        : [];

                    if (accounts.length > 0) {
                        const exactMatch = accounts.find(
                            (acc: any) =>
                                acc?.Account_Name?.trim().toLowerCase() ===
                                companyName.toLowerCase(),
                        );
                        existingZohoAccountId =
                            exactMatch?.id ||
                            accounts[0]?.id;
                    }
                } catch {
                    // Search error handled gracefully
                }

                if (existingZohoAccountId) {
                    // UPDATE existing Zoho Account
                    await zohoAction.updateAccount(
                        zohoAccessToken,
                        existingZohoAccountId,
                        zohoAccount,
                    );

                    updatedCount++;
                    results.push({
                        hubspotCompanyId,
                        companyName,
                        zohoAccountId:
                            existingZohoAccountId,
                        action: 'updated',
                    });
                } else {
                    // CREATE new Zoho Account
                    const createResponse =
                        await zohoAction.createAccount(
                            zohoAccessToken,
                            zohoAccount,
                        );

                    const createdZohoAccountId =
                        createResponse?.data?.[0]
                            ?.details?.id ||
                        createResponse?.data?.[0]?.id ||
                        null;

                    createdCount++;
                    results.push({
                        hubspotCompanyId,
                        companyName,
                        zohoAccountId:
                            createdZohoAccountId,
                        action: 'created',
                    });
                }
            } catch (error: any) {
                failedCount++;
                const errorMessage =
                    error.response?.data
                        ? JSON.stringify(
                            error.response.data,
                        )
                        : error.message ||
                        'Unknown error';

                results.push({
                    hubspotCompanyId,
                    companyName:
                        companyName || 'Unknown',
                    error: errorMessage,
                });
            }
        }

        return {
            status: 'completed',
            total: hubspotCompanies.length,
            created: createdCount,
            updated: updatedCount,
            failed: failedCount,
            results,
        };
    }

    // =========================================================
    // REVERSE COMPANY DATE-RANGE MIGRATION
    // HubSpot Companies → Zoho Accounts
    // =========================================================
    async migrateHubspotCompaniesByDateRange(
        hubspotAccessToken: string,
        zohoAccessToken: string,
        startDate: string,
        endDate: string,
    ) {
        if (!hubspotAccessToken?.trim()) {
            throw new HttpException(
                'HubSpot access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!zohoAccessToken?.trim()) {
            throw new HttpException(
                'Zoho access token is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!startDate?.trim()) {
            throw new HttpException(
                'Start date is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!endDate?.trim()) {
            throw new HttpException(
                'End date is missing',
                HttpStatus.BAD_REQUEST,
            );
        }

        const startTimestamp = new Date(startDate).getTime();
        const endTimestamp = new Date(endDate).getTime();

        if (isNaN(startTimestamp)) {
            throw new HttpException(
                'Invalid startDate format',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (isNaN(endTimestamp)) {
            throw new HttpException(
                'Invalid endDate format',
                HttpStatus.BAD_REQUEST,
            );
        }

        if (startTimestamp > endTimestamp) {
            throw new HttpException(
                'startDate cannot be greater than endDate',
                HttpStatus.BAD_REQUEST,
            );
        }

        let hubspotCompanies: any[] = [];
        try {
            hubspotCompanies =
                await getAllHubspotCompaniesByDateRange(
                    hubspotAccessToken,
                    startDate,
                    endDate,
                );
        } catch (error: any) {
            throw new HttpException(
                error.response?.data?.message || error.message || 'Failed to fetch HubSpot companies by date range',
                error.response?.status || HttpStatus.BAD_REQUEST,
            );
        }

        let createdCount = 0;
        let updatedCount = 0;
        let failedCount = 0;

        const results: Array<{
            hubspotCompanyId: string;
            companyName: string;
            zohoAccountId?: string | null;
            action?: 'created' | 'updated';
            error?: string;
        }> = [];

        for (const company of hubspotCompanies) {
            const hubspotCompanyId = String(company.id || '');
            const properties =
                company.properties || company || {};
            const companyName = String(
                properties.name || '',
            ).trim();

            try {
                if (!companyName) {
                    throw new Error(
                        'HubSpot company name is missing',
                    );
                }

                const zohoAccount =
                    mapHubspotCompanyToZoho(properties);

                // Duplicate Check: Search Zoho Accounts by Account_Name
                let existingZohoAccountId: string | undefined;

                try {
                    const searchResponse =
                        await zohoAction.findAccountByName(
                            zohoAccessToken,
                            companyName,
                        );

                    const accounts = Array.isArray(
                        searchResponse?.data,
                    )
                        ? searchResponse.data
                        : [];

                    if (accounts.length > 0) {
                        const exactMatch = accounts.find(
                            (acc: any) =>
                                acc?.Account_Name?.trim().toLowerCase() ===
                                companyName.toLowerCase(),
                        );
                        existingZohoAccountId =
                            exactMatch?.id ||
                            accounts[0]?.id;
                    }
                } catch {
                    // Search error handled gracefully
                }

                if (existingZohoAccountId) {
                    // UPDATE existing Zoho Account
                    await zohoAction.updateAccount(
                        zohoAccessToken,
                        existingZohoAccountId,
                        zohoAccount,
                    );

                    updatedCount++;
                    results.push({
                        hubspotCompanyId,
                        companyName,
                        zohoAccountId:
                            existingZohoAccountId,
                        action: 'updated',
                    });
                } else {
                    // CREATE new Zoho Account
                    const createResponse =
                        await zohoAction.createAccount(
                            zohoAccessToken,
                            zohoAccount,
                        );

                    const createdZohoAccountId =
                        createResponse?.data?.[0]
                            ?.details?.id ||
                        createResponse?.data?.[0]?.id ||
                        null;

                    createdCount++;
                    results.push({
                        hubspotCompanyId,
                        companyName,
                        zohoAccountId:
                            createdZohoAccountId,
                        action: 'created',
                    });
                }
            } catch (error: any) {
                failedCount++;
                const errorMessage =
                    error.response?.data
                        ? JSON.stringify(
                            error.response.data,
                        )
                        : error.message ||
                        'Unknown error';

                results.push({
                    hubspotCompanyId,
                    companyName:
                        companyName || 'Unknown',
                    error: errorMessage,
                });
            }
        }

        return {
            status: 'completed',
            startDate,
            endDate,
            total: hubspotCompanies.length,
            created: createdCount,
            updated: updatedCount,
            failed: failedCount,
            results,
        };
    }
}

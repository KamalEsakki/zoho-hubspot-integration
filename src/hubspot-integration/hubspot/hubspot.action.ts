import axios from 'axios';
import { hubspotConfig } from './hubspot.config';

// Exchange authorization code for access and refresh tokens
export async function exchangeHubspotCode(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    code: string,
) {
    const response = await axios.post(
        hubspotConfig.tokenUrl,
        new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code,
        }),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        },
    );

    return response.data;
}

// Refresh expired access token
export async function refreshHubspotToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
) {
    const response = await axios.post(
        hubspotConfig.tokenUrl,
        new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
        }),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        },
    );

    return response.data;
}

// Get list of HubSpot contacts with pagination
export async function getHubspotContacts(
    accessToken: string,
    limit: number = 10,
    after?: string,
) {
    const response = await axios.get(
        hubspotConfig.contactsUrl,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: {
                limit,
                ...(after ? { after } : {}),
            },
        },
    );

    return response.data;
}
// Get list of HubSpot deals with pagination
export async function getHubspotDeals(
    accessToken: string,
    limit: number = 10,
    after?: string,
) {
    const response = await axios.get(
        'https://api.hubapi.com/crm/v3/objects/deals',
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: {
                limit,
                ...(after ? { after } : {}),
                properties:
                    'dealname,amount,dealstage,closedate,createdate',
            },
        },
    );

    return response.data;
}

// Get a single HubSpot deal by ID
export async function getHubspotDealById(
    accessToken: string,
    dealId: string,
) {
    const response = await axios.get(
        `https://api.hubapi.com/crm/v3/objects/deals/${dealId}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: {
                properties:
                    'dealname,amount,dealstage,closedate,createdate',
            },
        },
    );

    return response.data;
}


// Get a HubSpot contact by ID
export async function getHubspotContactById(
    accessToken: string,
    contactId: string,
) {
    const response = await axios.get(
        `${hubspotConfig.contactsUrl}/${contactId}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: {
                properties:
                    'firstname,lastname,email,phone,company',
            },
        },
    );

    return response.data;
}

// Create a new HubSpot contact
export async function createHubspotContact(
    accessToken: string,
    contactData: {
        firstname?: string;
        lastname?: string;
        email?: string;
        phone?: string;
        company?: string;
    },
    companyId?: string,
) {
    const payload: any = {
        properties: {
            firstname: contactData.firstname,
            lastname: contactData.lastname,
            email: contactData.email,
            phone: contactData.phone,
            company: contactData.company,
        },
    };

    if (companyId) {
        payload.associations = [
            {
                to: {
                    id: companyId,
                },
                types: [
                    {
                        associationCategory: 'HUBSPOT_DEFINED',
                        associationTypeId: 279,
                    },
                    {
                        associationCategory: 'HUBSPOT_DEFINED',
                        associationTypeId: 1,
                    },
                ],
            },
        ];
    }

    const response = await axios.post(
        hubspotConfig.contactsUrl,
        payload,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    return response.data;
}

// Update an existing HubSpot contact
export async function updateHubspotContact(
    accessToken: string,
    contactId: string,
    contactData: {
        firstname?: string;
        lastname?: string;
        email?: string;
        phone?: string;
        company?: string;
    },
) {
    const response = await axios.patch(
        `${hubspotConfig.contactsUrl}/${contactId}`,
        {
            properties: {
                firstname: contactData.firstname,
                lastname: contactData.lastname,
                email: contactData.email,
                phone: contactData.phone,
                company: contactData.company,
            },
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    return response.data;
}

// Find an existing HubSpot contact by email
export async function findHubspotContactByEmail(
    accessToken: string,
    email: string,
) {
    const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/contacts/search',
        {
            filterGroups: [
                {
                    filters: [
                        {
                            propertyName: 'email',
                            operator: 'EQ',
                            value: email,
                        },
                    ],
                },
            ],
            properties: [
                'firstname',
                'lastname',
                'email',
                'phone',
                'company',
            ],
            limit: 1,
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    return response.data;
}

// Find a HubSpot company by exact name
export async function findHubspotCompanyByName(
    accessToken: string,
    companyName: string,
) {
    const trimmedName = companyName.trim();

    const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/companies/search',
        {
            filterGroups: [
                {
                    filters: [
                        {
                            propertyName: 'name',
                            operator: 'EQ',
                            value: trimmedName,
                        },
                    ],
                },
            ],
            properties: [
                'name',
            ],
            limit: 100,
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    const exactMatch = response.data.results?.find(
        (company: any) =>
            company.properties?.name?.trim().toLowerCase() ===
            trimmedName.toLowerCase(),
    );

    return {
        results: exactMatch
            ? [exactMatch]
            : response.data.results &&
                response.data.results.length > 0
                ? [response.data.results[0]]
                : [],
    };
}

// Get companies currently associated with a HubSpot contact
export async function getContactCompanyAssociations(
    accessToken: string,
    contactId: string,
) {
    try {
        const response = await axios.get(
            `https://api.hubapi.com/crm/v4/objects/contacts/${contactId}/associations/companies`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        );

        return response.data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return {
                results: [],
            };
        }

        throw error;
    }
}

// Associate a HubSpot contact with a HubSpot company
export async function associateContactWithCompany(
    accessToken: string,
    contactId: string,
    companyId: string,
) {
    try {
        const response = await axios.put(
            `https://api.hubapi.com/crm/v4/objects/contacts/${contactId}/associations/companies/${companyId}`,
            [
                {
                    associationCategory: 'HUBSPOT_DEFINED',
                    associationTypeId: 279,
                },
                {
                    associationCategory: 'HUBSPOT_DEFINED',
                    associationTypeId: 1,
                },
            ],
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            },
        );

        return response.data;
    } catch (dualError) {
        try {
            const response = await axios.put(
                `https://api.hubapi.com/crm/v4/objects/contacts/${contactId}/associations/companies/${companyId}`,
                [
                    {
                        associationCategory: 'HUBSPOT_DEFINED',
                        associationTypeId: 1,
                    },
                ],
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            return response.data;
        } catch (primaryError) {
            try {
                const response = await axios.put(
                    `https://api.hubapi.com/crm/v4/objects/contacts/${contactId}/associations/companies/${companyId}`,
                    [
                        {
                            associationCategory: 'HUBSPOT_DEFINED',
                            associationTypeId: 279,
                        },
                    ],
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                    },
                );

                return response.data;
            } catch (typeError) {
                const response = await axios.put(
                    `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}/associations/default/companies/${companyId}`,
                    {},
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                    },
                );

                return response.data;
            }
        }
    }
}

// Remove a HubSpot contact from a HubSpot company
export async function removeContactFromCompany(
    accessToken: string,
    contactId: string,
    companyId: string,
) {
    try {
        const response = await axios.delete(
            `https://api.hubapi.com/crm/v4/objects/contacts/${contactId}/associations/companies/${companyId}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        );

        return response.data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return null;
        }

        throw error;
    }
}

// Create a new HubSpot company
export async function createHubspotCompany(
    accessToken: string,
    companyData:
        | string
        | {
            name: string;
            phone?: string;
            website?: string;
            industry?: string;
        },
) {
    const data =
        typeof companyData === 'string'
            ? { name: companyData }
            : companyData;

    const properties: Record<string, string> = {
        name: data.name,
    };

    if (data.phone !== undefined && data.phone !== null && data.phone !== '') {
        properties.phone = data.phone;
    }
    if (data.website !== undefined && data.website !== null && data.website !== '') {
        properties.website = data.website;
    }
    if (data.industry !== undefined && data.industry !== null && data.industry !== '') {
        properties.industry = data.industry;
    }

    const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/companies',
        {
            properties,
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    return response.data;
}

// Update an existing HubSpot company
export async function updateHubspotCompany(
    accessToken: string,
    companyId: string,
    companyData: {
        name?: string;
        phone?: string;
        website?: string;
        industry?: string;
    },
) {
    const response = await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/companies/${companyId}`,
        {
            properties: {
                name: companyData.name,
                phone: companyData.phone,
                website: companyData.website,
                industry: companyData.industry,
            },
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    return response.data;
}

// Get a HubSpot company by ID
export async function getHubspotCompanyById(
    accessToken: string,
    companyId: string,
) {
    const response = await axios.get(
        `https://api.hubapi.com/crm/v3/objects/companies/${companyId}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: {
                properties: 'name,phone,website,industry',
            },
        },
    );

    return response.data;
}

// Get HubSpot contacts within a date range using CRM v3 Search API
export async function getHubspotContactsByDateRange(
    accessToken: string,
    startDate: string,
    endDate: string,
    limit: number = 100,
    after?: string,
) {
    const startValue = !isNaN(Number(startDate))
        ? startDate
        : !isNaN(new Date(startDate).getTime())
            ? String(new Date(startDate).getTime())
            : startDate;

    const endValue = !isNaN(Number(endDate))
        ? endDate
        : !isNaN(new Date(endDate).getTime())
            ? String(new Date(endDate).getTime())
            : endDate;

    const payload: any = {
        filterGroups: [
            {
                filters: [
                    {
                        propertyName: 'createdate',
                        operator: 'GTE',
                        value: startValue,
                    },
                    {
                        propertyName: 'createdate',
                        operator: 'LTE',
                        value: endValue,
                    },
                ],
            },
        ],
        properties: [
            'firstname',
            'lastname',
            'email',
            'phone',
            'company',
            'createdate',
        ],
        limit,
        ...(after ? { after } : {}),
    };

    const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/contacts/search',
        payload,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    return response.data;
}

// Get all HubSpot contacts within a date range by auto-paginating with cursor
export async function getAllHubspotContactsByDateRange(
    accessToken: string,
    startDate: string,
    endDate: string,
) {
    const limit = 100;
    const allContacts: any[] = [];
    let after: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
        const response = await getHubspotContactsByDateRange(
            accessToken,
            startDate,
            endDate,
            limit,
            after,
        );

        const records = Array.isArray(response?.results)
            ? response.results
            : [];

        if (records.length === 0) {
            break;
        }

        allContacts.push(...records);

        if (response?.paging?.next?.after) {
            after = response.paging.next.after;
        } else {
            hasMore = false;
        }
    }

    return allContacts;
}

// Get list of HubSpot companies with pagination
export async function getHubspotCompanies(
    accessToken: string,
    limit: number = 100,
    after?: string,
) {
    const response = await axios.get(
        'https://api.hubapi.com/crm/v3/objects/companies',
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: {
                limit,
                ...(after ? { after } : {}),
                properties:
                    'name,phone,website,industry,createdate,hs_lastmodifieddate',
            },
        },
    );

    return response.data;
}

// Get all HubSpot companies by auto-paginating with cursor
export async function getAllHubspotCompanies(
    accessToken: string,
) {
    const limit = 100;
    const allCompanies: any[] = [];
    let after: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
        const response = await getHubspotCompanies(
            accessToken,
            limit,
            after,
        );

        const records = Array.isArray(response?.results)
            ? response.results
            : [];

        if (records.length === 0) {
            break;
        }

        allCompanies.push(...records);

        if (response?.paging?.next?.after) {
            after = response.paging.next.after;
        } else {
            hasMore = false;
        }
    }

    return allCompanies;
}

// Get HubSpot companies within a date range using CRM v3 Search API
export async function getHubspotCompaniesByDateRange(
    accessToken: string,
    startDate: string,
    endDate: string,
    limit: number = 100,
    after?: string,
) {
    const startValue = !isNaN(Number(startDate))
        ? startDate
        : !isNaN(new Date(startDate).getTime())
            ? String(new Date(startDate).getTime())
            : startDate;

    const endValue = !isNaN(Number(endDate))
        ? endDate
        : !isNaN(new Date(endDate).getTime())
            ? String(new Date(endDate).getTime())
            : endDate;

    const payload: any = {
        filterGroups: [
            {
                filters: [
                    {
                        propertyName: 'createdate',
                        operator: 'GTE',
                        value: startValue,
                    },
                    {
                        propertyName: 'createdate',
                        operator: 'LTE',
                        value: endValue,
                    },
                ],
            },
        ],
        properties: [
            'name',
            'phone',
            'website',
            'industry',
            'createdate',
            'hs_lastmodifieddate',
        ],
        limit,
        ...(after ? { after } : {}),
    };

    const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/companies/search',
        payload,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    return response.data;
}

// Get all HubSpot companies within a date range by auto-paginating with cursor
export async function getAllHubspotCompaniesByDateRange(
    accessToken: string,
    startDate: string,
    endDate: string,
) {
    const limit = 100;
    const allCompanies: any[] = [];
    let after: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
        const response = await getHubspotCompaniesByDateRange(
            accessToken,
            startDate,
            endDate,
            limit,
            after,
        );

        const records = Array.isArray(response?.results)
            ? response.results
            : [];

        if (records.length === 0) {
            break;
        }

        allCompanies.push(...records);

        if (response?.paging?.next?.after) {
            after = response.paging.next.after;
        } else {
            hasMore = false;
        }
    }

    return allCompanies;
}
// Get HubSpot deals within a date range using CRM v3 Search API
export async function getHubspotDealsByDateRange(
    accessToken: string,
    startDate: string,
    endDate: string,
    limit: number = 100,
    after?: string,
) {
    const startValue = !isNaN(Number(startDate))
        ? startDate
        : !isNaN(new Date(startDate).getTime())
            ? String(new Date(startDate).getTime())
            : startDate;

    const endValue = !isNaN(Number(endDate))
        ? endDate
        : !isNaN(new Date(endDate).getTime())
            ? String(new Date(endDate).getTime())
            : endDate;

    const payload: any = {
        filterGroups: [
            {
                filters: [
                    {
                        propertyName: 'createdate',
                        operator: 'GTE',
                        value: startValue,
                    },
                    {
                        propertyName: 'createdate',
                        operator: 'LTE',
                        value: endValue,
                    },
                ],
            },
        ],
        properties: [
            'dealname',
            'amount',
            'dealstage',
            'closedate',
            'createdate',
        ],
        limit,
        ...(after ? { after } : {}),
    };

    const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/deals/search',
        payload,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    return response.data;
}

// Get all HubSpot deals within a date range by auto-paginating with cursor
export async function getAllHubspotDealsByDateRange(
    accessToken: string,
    startDate: string,
    endDate: string,
) {
    const limit = 100;
    const allDeals: any[] = [];
    let after: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
        const response = await getHubspotDealsByDateRange(
            accessToken,
            startDate,
            endDate,
            limit,
            after,
        );

        const records = Array.isArray(response?.results)
            ? response.results
            : [];

        if (records.length === 0) {
            break;
        }

        allDeals.push(...records);

        if (response?.paging?.next?.after) {
            after = response.paging.next.after;
        } else {
            hasMore = false;
        }
    }

    return allDeals;
}

// Create a new HubSpot lead object (CRM v3 leads object)
export async function createHubspotLead(
    accessToken: string,
    leadData: {
        firstname?: string;
        lastname?: string;
        email?: string;
        phone?: string;
        company?: string;
    },
) {
    const properties: Record<string, string> = {};

    if (leadData.firstname?.trim()) {
        properties.firstname = leadData.firstname.trim();
    }
    if (leadData.lastname?.trim()) {
        properties.lastname = leadData.lastname.trim();
    }
    if (leadData.email?.trim()) {
        properties.email = leadData.email.trim();
    }
    if (leadData.phone?.trim()) {
        properties.phone = leadData.phone.trim();
    }
    if (leadData.company?.trim()) {
        properties.company = leadData.company.trim();
    }

    const leadName =
        [leadData.firstname, leadData.lastname]
            .filter(Boolean)
            .join(' ')
            .trim() ||
        leadData.email?.trim() ||
        leadData.company?.trim() ||
        'New Lead';

    properties.hs_lead_name = leadName;

    const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/leads',
        {
            properties,
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    return response.data;
}
// Find an existing HubSpot deal by exact name
export async function findHubspotDealByName(
    accessToken: string,
    dealName: string,
) {
    const trimmedName = dealName.trim();

    const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/deals/search',
        {
            filterGroups: [
                {
                    filters: [
                        {
                            propertyName: 'dealname',
                            operator: 'EQ',
                            value: trimmedName,
                        },
                    ],
                },
            ],
            properties: [
                'dealname',
                'amount',
                'dealstage',
                'closedate',
            ],
            limit: 1,
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    return response.data;
}

// Create a new HubSpot deal
export async function createHubspotDeal(
    accessToken: string,
    dealData: {
        dealname: string;
        amount?: string;
        dealstage?: string;
        closedate?: string;
    },
) {
    const properties: Record<string, string> = {
        dealname: dealData.dealname,
    };

    if (dealData.amount !== undefined && dealData.amount !== '') {
        properties.amount = dealData.amount;
    }

    if (dealData.dealstage !== undefined && dealData.dealstage !== '') {
        properties.dealstage = dealData.dealstage;
    }

    if (dealData.closedate !== undefined && dealData.closedate !== '') {
        properties.closedate = dealData.closedate;
    }

    const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/deals',
        {
            properties,
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    return response.data;
}

// Update an existing HubSpot deal
export async function updateHubspotDeal(
    accessToken: string,
    dealId: string,
    dealData: {
        dealname?: string;
        amount?: string;
        dealstage?: string;
        closedate?: string;
    },
) {
    const properties: Record<string, string> = {};

    if (dealData.dealname !== undefined) {
        properties.dealname = dealData.dealname;
    }

    if (dealData.amount !== undefined) {
        properties.amount = dealData.amount;
    }

    if (dealData.dealstage !== undefined) {
        properties.dealstage = dealData.dealstage;
    }

    if (dealData.closedate !== undefined) {
        properties.closedate = dealData.closedate;
    }

    const response = await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/deals/${dealId}`,
        {
            properties,
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    return response.data;
}
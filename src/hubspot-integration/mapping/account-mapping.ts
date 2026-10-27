export interface ZohoAccount {
    Account_Name?: string;
    Phone?: string;
    Website?: string;
    Industry?: string;
}

export interface HubspotCompany {
    name?: string;
    phone?: string;
    website?: string;
    industry?: string;
}

export function mapZohoAccountToHubspot(
    zohoAccount: ZohoAccount,
): HubspotCompany {

    let hubspotIndustry: string | undefined;

    if (zohoAccount.Industry === 'Technology') {
        hubspotIndustry =
            'INFORMATION_TECHNOLOGY_AND_SERVICES';
    } else {
        hubspotIndustry =
            zohoAccount.Industry;
    }

    return {
        name: zohoAccount.Account_Name,
        phone: zohoAccount.Phone,
        website: zohoAccount.Website,
        industry: hubspotIndustry,
    };
}

export function mapHubspotCompanyToZoho(
    hubspotCompany: HubspotCompany | Record<string, any>,
): ZohoAccount {
    let zohoIndustry: string | undefined;

    if (
        hubspotCompany.industry === 'INFORMATION_TECHNOLOGY_AND_SERVICES' ||
        hubspotCompany.industry === 'Technology'
    ) {
        zohoIndustry = 'Technology';
    } else if (
        hubspotCompany.industry &&
        typeof hubspotCompany.industry === 'string' &&
        hubspotCompany.industry.trim()
    ) {
        zohoIndustry = hubspotCompany.industry.trim();
    }

    const zohoAccount: ZohoAccount = {
        Account_Name: hubspotCompany.name?.trim(),
    };

    if (
        hubspotCompany.phone &&
        typeof hubspotCompany.phone === 'string' &&
        hubspotCompany.phone.trim()
    ) {
        zohoAccount.Phone = hubspotCompany.phone.trim();
    }

    if (
        hubspotCompany.website &&
        typeof hubspotCompany.website === 'string' &&
        hubspotCompany.website.trim()
    ) {
        zohoAccount.Website = hubspotCompany.website.trim();
    }

    if (zohoIndustry) {
        zohoAccount.Industry = zohoIndustry;
    }

    return zohoAccount;
}
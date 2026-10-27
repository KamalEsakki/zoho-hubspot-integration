export interface ZohoContact {
    First_Name?: string;
    Last_Name?: string;
    Email?: string;
    Phone?: string;
    Account_Name?: {
        name?: string;
        id?: string;
    } | string;
    Account_name?: {
        name?: string;
        id?: string;
    } | string;
}

export interface HubspotContact {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    company?: string;
}

export function getZohoAccountName(
    zohoContact?: ZohoContact,
): string | undefined {
    if (!zohoContact) {
        return undefined;
    }

    const account =
        zohoContact.Account_Name ?? (zohoContact as any).Account_name;

    if (!account) {
        return undefined;
    }

    if (typeof account === 'object' && account.name) {
        return account.name.trim();
    }

    if (typeof account === 'string' && account.trim()) {
        return account.trim();
    }

    return undefined;
}

export function mapZohoContactToHubspot(
    zohoContact: ZohoContact,
): HubspotContact {
    return {
        firstname: zohoContact.First_Name,
        lastname: zohoContact.Last_Name,
        email: zohoContact.Email,
        phone: zohoContact.Phone,
        company: getZohoAccountName(zohoContact),
    };
}
export function mapHubspotContactToZoho(
    hubspotContact: HubspotContact,
): ZohoContact {
    return {
        First_Name: hubspotContact.firstname,
        Last_Name: hubspotContact.lastname,
        Email: hubspotContact.email,
        Phone: hubspotContact.phone,
        Account_Name: hubspotContact.company,
    };
}
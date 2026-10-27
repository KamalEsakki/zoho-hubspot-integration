export interface ZohoLead {
    First_Name?: string;
    Last_Name?: string;
    Email?: string;
    Phone?: string;
    Company?: string;
}

export interface HubspotLead {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    company?: string;
}

export function mapZohoLeadToHubspot(
    zohoLead: ZohoLead,
): HubspotLead {

    const hubspotLead: HubspotLead = {
        firstname: zohoLead.First_Name,
        lastname: zohoLead.Last_Name,
        phone: zohoLead.Phone,
        company: zohoLead.Company,
    };

    if (
        zohoLead.Email &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(zohoLead.Email) &&
        !zohoLead.Email.toLowerCase().endsWith('.invalid')
    ) {
        hubspotLead.email = zohoLead.Email;
    }

    return hubspotLead;
}
export const hubspotConfig = {
    oauthUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v3/token',

    contactsUrl:
        'https://api.hubapi.com/crm/v3/objects/contacts',

    scopes: [
        'oauth',
        'crm.objects.contacts.read',
        'crm.objects.contacts.write',
        'crm.objects.leads.read',
        'crm.objects.leads.write',


    ],
};
const hubspotDealStageMap: Record<string, string> = {
    Qualification: 'qualifiedtobuy',
    'Needs Analysis': 'presentationscheduled',
    'Value Proposition': 'presentationscheduled',
    'Id. Decision Makers': 'decisionmakerboughtin',
    'Proposal/Price Quote': 'contractsent',
    'Negotiation/Review': 'contractsent',
    'Closed Won': 'closedwon',
    'Closed Lost': 'closedlost',
};

export function mapZohoDealToHubspot(zohoDeal: any) {
    return {
        dealname: zohoDeal.Deal_Name,

        amount:
            zohoDeal.Amount !== undefined &&
                zohoDeal.Amount !== null
                ? String(zohoDeal.Amount)
                : undefined,

        dealstage:
            hubspotDealStageMap[zohoDeal.Stage] ??
            zohoDeal.Stage,

        closedate: zohoDeal.Closing_Date,
    };
}

const zohoDealStageMap: Record<string, string> = {
    qualifiedtobuy: 'Qualification',
    presentationscheduled: 'Needs Analysis',
    decisionmakerboughtin: 'Id. Decision Makers',
    contractsent: 'Proposal/Price Quote',
    closedwon: 'Closed Won',
    closedlost: 'Closed Lost',
};

export function mapHubspotDealToZoho(hubspotDeal: any) {
    const properties = hubspotDeal?.properties ?? hubspotDeal;

    return {
        Deal_Name: properties.dealname,

        Amount:
            properties.amount !== undefined &&
                properties.amount !== null
                ? Number(properties.amount)
                : undefined,

        Stage:
            zohoDealStageMap[properties.dealstage] ??
            properties.dealstage,

        Closing_Date: properties.closedate
            ? properties.closedate.split('T')[0]
            : undefined,
    };
}
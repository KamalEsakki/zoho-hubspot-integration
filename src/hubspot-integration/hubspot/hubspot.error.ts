import axios from 'axios';

export function handleHubspotError(error: unknown) {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;

        if (status === 401) {
            return {
                statusCode: 401,
                message: 'HubSpot authentication failed',
                details: data,
            };
        }

        if (status === 404) {
            return {
                statusCode: 404,
                message: 'HubSpot resource not found',
                details: data,
            };
        }

        if (status === 409) {
            return {
                statusCode: 409,
                message: 'HubSpot duplicate resource',
                details: data,
            };
        }

        if (status === 429) {
            const retryAfter =
                error.response?.headers?.['retry-after'];

            return {
                statusCode: 429,
                message: 'HubSpot rate limit exceeded',
                retryAfter: retryAfter ?? null,
                details: data,
            };
        }

        if (status && status >= 400 && status < 500) {
            return {
                statusCode: status,
                message: 'HubSpot request failed',
                details: data,
            };
        }

        if (status && status >= 500) {
            return {
                statusCode: status,
                message: 'HubSpot server error',
                details: data,
            };
        }

        if (error.request) {
            return {
                statusCode: 503,
                message: 'Unable to connect to HubSpot',
            };
        }
    }

    return {
        statusCode: 500,
        message: 'Unexpected HubSpot error',
    };
}
import {
    HttpException,
    HttpStatus,
} from '@nestjs/common';

export function handleZohoError(error: any): never {
    if (error instanceof HttpException) {
        throw error;
    }

    const status = error?.response?.status;
    const zohoError = error?.response?.data;

    if (status === 401) {
        throw new HttpException(
            {
                message: 'Zoho authentication failed',
                error: zohoError,
            },
            HttpStatus.UNAUTHORIZED,
        );
    }

    if (status === 400) {
        throw new HttpException(
            {
                message: 'Invalid Zoho request',
                error: zohoError,
            },
            HttpStatus.BAD_REQUEST,
        );
    }

    if (status === 404) {
        throw new HttpException(
            {
                message: 'Zoho record not found',
                error: zohoError,
            },
            HttpStatus.NOT_FOUND,
        );
    }

    if (status === 429) {
        throw new HttpException(
            {
                message: 'Zoho API rate limit exceeded',
                error: zohoError,
            },
            HttpStatus.TOO_MANY_REQUESTS,
        );
    }

    throw new HttpException(
        {
            message: 'Zoho API request failed',
            error:
                zohoError ||
                error?.message ||
                'Unknown error',
        },
        status || HttpStatus.INTERNAL_SERVER_ERROR,
    );
}
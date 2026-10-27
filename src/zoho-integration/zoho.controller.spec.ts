import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Controller('zoho')
export class ZohoController {
  constructor(private configService: ConfigService) { }

  @Get('auth')
  getAuthUrl() {
    const clientId = this.configService.get<string>('ZOHO_CLIENT_ID');
    const redirectUri = this.configService.get<string>('ZOHO_REDIRECT_URI');

    const authUrl =
      `https://accounts.zoho.com/oauth/v2/auth` +
      `?response_type=code` +
      `&client_id=${clientId}` +
      `&scope=ZohoCRM.modules.ALL` +
      `&redirect_uri=${redirectUri}` +
      `&access_type=offline` +
      `&prompt=consent`;

    return {
      authUrl,
    };
  }

  @Get('callback')
  async zohoCallback(@Query('code') code: string) {
    const clientId = this.configService.get<string>('ZOHO_CLIENT_ID');
    const clientSecret =
      this.configService.get<string>('ZOHO_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('ZOHO_REDIRECT_URI');

    const response = await axios.post(
      'https://accounts.zoho.in/oauth/v2/token',
      null,
      {
        params: {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        },
      },
    );

    return {
      message: 'Zoho OAuth successful',
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }

  @Get('refresh')
  async refreshAccessToken(@Query('refreshToken') refreshToken: string) {
    const clientId = this.configService.get<string>('ZOHO_CLIENT_ID');
    const clientSecret =
      this.configService.get<string>('ZOHO_CLIENT_SECRET');

    const response = await axios.post(
      'https://accounts.zoho.in/oauth/v2/token',
      null,
      {
        params: {
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        },
      },
    );

    return {
      message: 'Zoho access token refreshed successfully',
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
    };
  }

  @Get('contacts')
  async getContacts(@Query('accessToken') accessToken: string) {
    const response = await axios.get(
      'https://www.zohoapis.in/crm/v8/Contacts',
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      },
    );

    return response.data;
  }
}
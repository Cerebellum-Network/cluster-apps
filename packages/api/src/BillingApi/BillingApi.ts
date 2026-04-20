import axios from 'axios';

export interface RegisterAccountRequest {
  accountId: string;
  email: string;
}

export interface RegisterAccountResponse {
  success: boolean;
  message?: string;
}

export class BillingApi {
  constructor(protected readonly baseUrl: string) {}

  protected get api() {
    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000, // 10 second timeout
    });
  }

  /**
   * Validate the request data structure
   */
  private validateRequestData(data: RegisterAccountRequest): void {
    if (!data.accountId || typeof data.accountId !== 'string') {
      throw new Error('Invalid accountId: must be a non-empty string');
    }
    if (!data.email || typeof data.email !== 'string' || !data.email.includes('@')) {
      throw new Error('Invalid email: must be a valid email address');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.api.get('/health');
      return true;
    } catch (error) {
      return false;
    }
  }

  async registerAccount(accountData: RegisterAccountRequest): Promise<RegisterAccountResponse> {
    try {
      // Validate request data
      this.validateRequestData(accountData);
      
      console.log('🔗 BillingApi: Using baseURL:', this.baseUrl);
      console.log('📤 BillingApi: Sending data:', accountData);
      console.log('📤 BillingApi: Full request URL:', `${this.baseUrl}/api/register-account`);
      
      const response = await this.api.post<RegisterAccountResponse>('/api/register-account', accountData);
      console.log('✅ BillingApi: Response received:', response.data);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ BillingApi: Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers,
          url: error.config?.url,
          method: error.config?.method,
          requestData: error.config?.data
        });
        
        throw new Error(`Billing service error: ${error.response?.status} ${error.response?.statusText} - ${JSON.stringify(error.response?.data)}`);
      }
      throw new Error('Failed to register account in billing service');
    }
  }

  /**
   * Test the exact request format that will be sent
   */
  async testRequestFormat(): Promise<void> {
    const testData: RegisterAccountRequest = {
      accountId: '6V6DEU6AX5SWkWJUuWaiE5DXrEzUJe3hEVfqi7j5J5NYEZuK',
      email: 'test@example.com'
    };
    
    console.log('🧪 BillingApi: Testing request format...');
    console.log('📋 Test data:', testData);
    console.log('🔗 Test URL:', `${this.baseUrl}/api/register-account`);
    
    try {
      const response = await this.api.post('/api/register-account', testData);
      console.log('✅ Test request successful:', response.data);
    } catch (error) {
      console.error('❌ Test request failed:', error);
      if (axios.isAxiosError(error)) {
        console.error('Test error details:', {
          status: error.response?.status,
          data: error.response?.data
        });
      }
    }
  }
}

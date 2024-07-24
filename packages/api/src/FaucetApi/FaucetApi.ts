export class FaucetApi {
  private baseUrl = import.meta.env.VITE_FAUCET_ENDPOINT || '';

  sendTokens = async (address: string, amount: number) => {
    const body = {
      scope: 'CLUSTER_MANAGEMENT',
      walletType: 'CERE',
      address,
      amount,
    };

    const response = await fetch(`${this.baseUrl}`, {
      method: 'post',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    return response.json();
  };
}

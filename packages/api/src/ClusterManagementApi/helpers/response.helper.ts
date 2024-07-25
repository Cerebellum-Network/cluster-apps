export function parseResponse(response: any) {
  if (response == null || typeof response !== 'object' || !('code' in response) || typeof response.code !== 'string') {
    throw new Error(`Failed to parse response ${response}`);
  }

  if (response.code !== 'SUCCESS') {
    throw new Error(`Response code: ${response.code} message: ${response.message} details: ${response.details}`);
  }

  return response.data;
}

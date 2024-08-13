export const getUTMParameters = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const utmParams: Record<string, string> = {};

  ['utm_source', 'utm_medium', 'utm_campaign'].forEach((key) => {
    const value = urlParams.get(key);
    if (value) {
      utmParams[key] = value;
    }
  });

  return utmParams;
};

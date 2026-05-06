const buildBackendBaseUrl = (): string => {
  const rawBackendUrl = String(process.env.BACKEND_URL || "").trim();
  if (!rawBackendUrl) {
    return "";
  }

  const backendUrl = rawBackendUrl.replace(/\/+$/, "");
  const proxyPort = String(process.env.PROXY_PORT || "").trim();
  if (!proxyPort) {
    return backendUrl;
  }

  try {
    const parsed = new URL(backendUrl);
    if (parsed.port) {
      return backendUrl;
    }

    return `${backendUrl}:${proxyPort}`;
  } catch (_error) {
    if (/:\d+$/.test(backendUrl)) {
      return backendUrl;
    }
    return `${backendUrl}:${proxyPort}`;
  }
};

export default buildBackendBaseUrl;

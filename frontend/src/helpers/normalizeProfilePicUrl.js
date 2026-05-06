const getBackendBaseUrl = () => {
  const envUrl = String(process.env.REACT_APP_BACKEND_URL || "").trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8081`;
  }

  return "";
};

const LOCALHOST_MARKERS = [
  "localhost:3000",
  "localhost:3003",
  "localhost:3010",
  "127.0.0.1:3000",
  "127.0.0.1:3003",
  "127.0.0.1:3010"
];

export const normalizeProfilePicUrl = (rawUrl) => {
  const backendBaseUrl = getBackendBaseUrl();
  const fallback = backendBaseUrl ? `${backendBaseUrl}/nopicture.png` : "";

  if (!rawUrl || typeof rawUrl !== "string") {
    return fallback;
  }

  const value = rawUrl.trim();
  if (!value) {
    return fallback;
  }

  const lowered = value.toLowerCase();
  if (LOCALHOST_MARKERS.some(marker => lowered.includes(marker))) {
    return fallback;
  }

  if (value === "/nopicture.png") {
    return fallback;
  }

  try {
    const parsed = new URL(value, backendBaseUrl || undefined);
    if (parsed.hostname === "pps.whatsapp.net") {
      if (!backendBaseUrl) {
        return value;
      }

      return `${backendBaseUrl}/profile-pic?url=${encodeURIComponent(value)}`;
    }
  } catch (_error) {
    return value;
  }

  return value;
};


import buildBackendBaseUrl from "./buildBackendBaseUrl";

const LOCALHOST_MARKERS = [
  "localhost:3000",
  "localhost:3003",
  "localhost:8081",
  "127.0.0.1:3000",
  "127.0.0.1:3003",
  "127.0.0.1:8081"
];

const buildFallbackUrl = (): string => {
  const backendUrl = buildBackendBaseUrl();
  if (!backendUrl) {
    return "/nopicture.png";
  }
  return `${backendUrl}/nopicture.png`;
};

const buildProxyUrl = (rawUrl: string): string => {
  const backendUrl = buildBackendBaseUrl();
  const encodedUrl = encodeURIComponent(rawUrl);

  if (!backendUrl) {
    return `/profile-pic?url=${encodedUrl}`;
  }

  return `${backendUrl}/profile-pic?url=${encodedUrl}`;
};

export const normalizeProfilePicUrl = (
  profilePicUrl?: string | null
): string => {
  const fallbackUrl = buildFallbackUrl();

  if (!profilePicUrl || typeof profilePicUrl !== "string") {
    return fallbackUrl;
  }

  const normalized = profilePicUrl.trim();
  if (!normalized) {
    return fallbackUrl;
  }

  const lowered = normalized.toLowerCase();
  if (LOCALHOST_MARKERS.some(marker => lowered.includes(marker))) {
    return fallbackUrl;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.hostname === "pps.whatsapp.net") {
      return buildProxyUrl(normalized);
    }
  } catch (_error) {
    // Keep non-URL values unchanged.
  }

  return normalized;
};

export const normalizeContactProfilePic = <T>(contact: T): T => {
  if (!contact || typeof contact !== "object") {
    return contact;
  }

  const maybeContact = contact as { profilePicUrl?: string | null };
  maybeContact.profilePicUrl = normalizeProfilePicUrl(
    maybeContact.profilePicUrl
  );

  return contact;
};


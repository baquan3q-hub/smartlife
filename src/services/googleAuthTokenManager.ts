/**
 * Google Auth Token Manager
 * Quản lý tập trung OAuth token cho tất cả Google API services (Tasks, Calendar, Sheets)
 * Tái sử dụng pattern từ googleTasksService.ts nhưng dùng chung cho mọi service
 */

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'smartlife_google_access_token',
  REFRESH_TOKEN: 'smartlife_google_refresh_token',
  EXPIRES_AT: 'smartlife_google_expires_at',
};

// Also check legacy keys from googleTasksService for backward compatibility
const LEGACY_KEYS = {
  ACCESS_TOKEN: 'smartlife_gtasks_access_token',
  REFRESH_TOKEN: 'smartlife_gtasks_refresh_token',
  EXPIRES_AT: 'smartlife_gtasks_expires_at',
};

/**
 * Lưu Google OAuth token (gọi từ AuthContext khi login hoặc token refresh)
 */
export const saveGoogleToken = (
  token: string,
  expiresInSeconds: number,
  refreshToken?: string
): void => {
  if (typeof window === 'undefined') return;
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
  if (refreshToken && refreshToken.trim()) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken.trim());
  }
  // Also save to legacy keys for backward compat with googleTasksService
  localStorage.setItem(LEGACY_KEYS.ACCESS_TOKEN, token);
  localStorage.setItem(LEGACY_KEYS.EXPIRES_AT, expiresAt.toString());
  if (refreshToken && refreshToken.trim()) {
    localStorage.setItem(LEGACY_KEYS.REFRESH_TOKEN, refreshToken.trim());
  }
  window.dispatchEvent(new CustomEvent('google_auth_changed'));
  window.dispatchEvent(new CustomEvent('google_tasks_auth_changed'));
};

/**
 * Lấy access token hợp lệ. Trả về null nếu không có hoặc đã hết hạn.
 * Tự động tìm từ Supabase cached session nếu token riêng đã hết hạn.
 */
export const getValidGoogleToken = (): string | null => {
  if (typeof window === 'undefined') return null;

  // 1. Check unified token first
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const expiresAtStr = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
  if (token && expiresAtStr) {
    const expiresAt = parseInt(expiresAtStr, 10);
    if (!Number.isNaN(expiresAt) && Date.now() < expiresAt - 30000) {
      return token;
    }
  }

  // 2. Check legacy token (from googleTasksService)
  const legacyToken = localStorage.getItem(LEGACY_KEYS.ACCESS_TOKEN);
  const legacyExpiresAtStr = localStorage.getItem(LEGACY_KEYS.EXPIRES_AT);
  if (legacyToken && legacyExpiresAtStr) {
    const expiresAt = parseInt(legacyExpiresAtStr, 10);
    if (!Number.isNaN(expiresAt) && Date.now() < expiresAt - 30000) {
      // Migrate to unified keys
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, legacyToken);
      localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, legacyExpiresAtStr);
      return legacyToken;
    }
  }

  // 3. Try to extract from Supabase cached session
  try {
    const cachedSessionStr = localStorage.getItem('smartlife_cached_session');
    if (cachedSessionStr) {
      const cachedSession = JSON.parse(cachedSessionStr);
      if (cachedSession?.provider_token) {
        saveGoogleToken(
          cachedSession.provider_token,
          cachedSession.expires_in || 3600,
          cachedSession.provider_refresh_token
        );
        return cachedSession.provider_token;
      }
    }
  } catch (e) {
    console.warn('[GoogleAuth] Error reading cached session:', e);
  }

  return null;
};

/**
 * Kiểm tra Google đã kết nối chưa
 */
export const isGoogleConnected = (): boolean => {
  return getValidGoogleToken() !== null;
};

/**
 * Ngắt kết nối Google (xóa tất cả tokens)
 */
export const disconnectGoogle = (): void => {
  if (typeof window === 'undefined') return;
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  Object.values(LEGACY_KEYS).forEach(key => localStorage.removeItem(key));
  window.dispatchEvent(new CustomEvent('google_auth_changed'));
  window.dispatchEvent(new CustomEvent('google_tasks_auth_changed'));
};

/**
 * Helper: Gọi Google REST API với auto-retry khi 401
 */
export const googleApiFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getValidGoogleToken();
  if (!token) {
    throw new Error('Google chưa được kết nối. Vui lòng đăng nhập lại bằng Google.');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    // Token expired — clear and throw
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    localStorage.removeItem(LEGACY_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(LEGACY_KEYS.EXPIRES_AT);
    throw new Error('Google token đã hết hạn. Vui lòng đăng nhập lại.');
  }

  return response;
};

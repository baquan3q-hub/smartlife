/**
 * Google Auth Token Manager
 * Quản lý tập trung OAuth token cho tất cả Google API services (Tasks, Calendar, Sheets)
 * Hỗ trợ Silent SSO Token Renewal và Auto-Retry khi Token hết hạn
 */

const STORAGE_KEYS = {
  CLIENT_ID: 'smartlife_google_client_id',
  ACCESS_TOKEN: 'smartlife_google_access_token',
  REFRESH_TOKEN: 'smartlife_google_refresh_token',
  EXPIRES_AT: 'smartlife_google_expires_at',
  LAST_USER_EMAIL: 'smartlife_google_user_email',
};

// Also check legacy keys from googleTasksService for backward compatibility
const LEGACY_KEYS = {
  CLIENT_ID: 'smartlife_gtasks_client_id',
  ACCESS_TOKEN: 'smartlife_gtasks_access_token',
  REFRESH_TOKEN: 'smartlife_gtasks_refresh_token',
  EXPIRES_AT: 'smartlife_gtasks_expires_at',
};

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

/**
 * Lấy Client ID của Google từ Storage hoặc Env
 */
export const getGoogleClientId = (): string => {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || localStorage.getItem(LEGACY_KEYS.CLIENT_ID);
  if (stored && stored.trim()) return stored.trim();
  const envId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  return (envId && typeof envId === 'string') ? envId.trim() : '';
};

export const setGoogleClientId = (clientId: string): void => {
  if (typeof window === 'undefined') return;
  if (clientId.trim()) {
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId.trim());
    localStorage.setItem(LEGACY_KEYS.CLIENT_ID, clientId.trim());
  } else {
    localStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
    localStorage.removeItem(LEGACY_KEYS.CLIENT_ID);
  }
};

/**
 * Lưu Google OAuth token (gọi từ AuthContext khi login hoặc token refresh)
 */
export const saveGoogleToken = (
  token: string,
  expiresInSeconds: number,
  refreshToken?: string,
  userEmail?: string
): void => {
  if (typeof window === 'undefined') return;
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
  if (refreshToken && refreshToken.trim()) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken.trim());
  }
  if (userEmail && userEmail.trim()) {
    localStorage.setItem(STORAGE_KEYS.LAST_USER_EMAIL, userEmail.trim());
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
 * Lấy access token đồng bộ. Trả về null nếu không có hoặc đã hết hạn.
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
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, legacyToken);
      localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, legacyExpiresAtStr);
      return legacyToken;
    }
  }

  return null;
};

/**
 * Kiểm tra Google đã kết nối chưa (sync)
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

// ────────────────────────────────────────────────────────────
// GOOGLE IDENTITY SERVICES (GIS) SILENT SSO & TOKEN RENEWAL
// ────────────────────────────────────────────────────────────

let gisLoadedPromise: Promise<void> | null = null;

export const loadGoogleGisScript = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();

  if ((window as any).google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (gisLoadedPromise) return gisLoadedPromise;

  gisLoadedPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById('google-gis-sdk');
    if (existing) {
      if ((window as any).google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gis-sdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không thể tải Google Identity Services SDK.'));
    document.head.appendChild(script);
  });

  return gisLoadedPromise;
};

// In-flight promise tracker to prevent multiple simultaneous GIS popup / silent requests
let silentAuthPromise: Promise<string | null> | null = null;

/**
 * Tự động kết nối Silent SSO trong nền bằng Google Identity Services (GIS)
 * Không mở popup, không chuyển trang, tự động hoàn tất trong < 500ms nếu user đã login Google trên browser.
 */
export const autoSilentGoogleAuth = async (hintEmail?: string): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  // If silent auth is already in progress, await the ongoing request
  if (silentAuthPromise) {
    return silentAuthPromise;
  }

  silentAuthPromise = (async () => {
    try {
      const clientId = getGoogleClientId();
      if (!clientId) {
        console.warn('[GoogleAuth] Missing Google Client ID for Silent SSO.');
        return null;
      }

      await loadGoogleGisScript();

      const targetEmail = hintEmail || localStorage.getItem(STORAGE_KEYS.LAST_USER_EMAIL) || undefined;

      return await new Promise<string | null>((resolve) => {
        let isSettled = false;

        const timer = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            console.warn('[GoogleAuth] Silent SSO request timed out.');
            resolve(null);
          }
        }, 8000);

        try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: GOOGLE_SCOPES,
            callback: (response: any) => {
              if (isSettled) return;
              isSettled = true;
              clearTimeout(timer);

              if (response?.access_token) {
                const expiresIn = parseInt(response.expires_in, 10) || 3600;
                saveGoogleToken(response.access_token, expiresIn, undefined, targetEmail);
                console.log('[GoogleAuth] Silent SSO token renewal successful! Token valid for:', expiresIn, 's');
                resolve(response.access_token);
              } else {
                console.warn('[GoogleAuth] Silent SSO notice:', response?.error_description || response?.error || 'No token');
                resolve(null);
              }
            },
            error_callback: (err: any) => {
              if (isSettled) return;
              isSettled = true;
              clearTimeout(timer);
              console.warn('[GoogleAuth] Silent SSO error_callback:', err);
              resolve(null);
            },
          });

          // Request access token silently without prompting user
          client.requestAccessToken({
            prompt: '',
            hint: targetEmail,
          });
        } catch (err) {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timer);
            console.warn('[GoogleAuth] Failed to initialize token client for silent auth:', err);
            resolve(null);
          }
        }
      });
    } catch (e) {
      console.warn('[GoogleAuth] Silent auth error:', e);
      return null;
    } finally {
      silentAuthPromise = null;
    }
  })();

  return silentAuthPromise;
};

/**
 * Yêu cầu cấp quyền Google Token qua GIS với tương tác người dùng (popup consent)
 */
export const requestUnifiedGoogleToken = async (
  options: { prompt?: 'consent' | 'select_account' | ''; hintEmail?: string } = {}
): Promise<string> => {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Vui lòng cấu hình Google Client ID để cấp quyền truy cập.');
  }

  await loadGoogleGisScript();

  const targetEmail = options.hintEmail || localStorage.getItem(STORAGE_KEYS.LAST_USER_EMAIL) || undefined;

  return new Promise<string>((resolve, reject) => {
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_SCOPES,
        callback: (response: any) => {
          if (response?.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response?.access_token) {
            const expiresIn = parseInt(response.expires_in, 10) || 3600;
            saveGoogleToken(response.access_token, expiresIn, undefined, targetEmail);
            resolve(response.access_token);
          } else {
            reject(new Error('Không nhận được Access Token từ Google.'));
          }
        },
      });

      client.requestAccessToken({
        prompt: options.prompt !== undefined ? options.prompt : 'consent',
        hint: targetEmail,
      });
    } catch (err: any) {
      reject(new Error(err?.message || 'Lỗi khởi tạo Google Token Client.'));
    }
  });
};

/**
 * Đảm bảo luôn có Access Token hợp lệ trước khi gọi bất kỳ API nào.
 * Tự động làm mới âm thầm (Silent Refresh) nếu token đã hết hạn.
 */
export const ensureValidGoogleToken = async (hintEmail?: string): Promise<string | null> => {
  const currentToken = getValidGoogleToken();
  if (currentToken) {
    return currentToken;
  }

  // Token missing or expired -> attempt Silent SSO renewal
  const renewedToken = await autoSilentGoogleAuth(hintEmail);
  return renewedToken;
};

/**
 * Helper: Gọi Google REST API với Auto-Refresh & Auto-Retry khi 401
 */
export const googleApiFetch = async (
  url: string,
  options: RequestInit = {},
  hintEmail?: string
): Promise<Response> => {
  let token = await ensureValidGoogleToken(hintEmail);
  if (!token) {
    throw new Error('Google chưa được kết nối hoặc phiên đăng nhập đã hết hạn. Vui lòng kết nối tài khoản Google.');
  }

  const buildHeaders = (authToken: string) => {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${authToken}`);
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return headers;
  };

  let response = await fetch(url, { ...options, headers: buildHeaders(token) });

  // If 401 Unauthorized -> Token expired on Google servers, attempt 1 silent refresh and retry
  if (response.status === 401) {
    console.warn('[GoogleAuth] 401 received from Google API. Attempting silent token renewal...');
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    localStorage.removeItem(LEGACY_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(LEGACY_KEYS.EXPIRES_AT);

    const freshToken = await autoSilentGoogleAuth(hintEmail);
    if (freshToken) {
      response = await fetch(url, { ...options, headers: buildHeaders(freshToken) });
    }

    if (response.status === 401) {
      disconnectGoogle();
      throw new Error('Phiên đăng nhập Google đã hết hạn. Vui lòng kết nối lại tài khoản Google.');
    }
  }

  return response;
};

/**
 * Geolocation Service
 * Đọc tọa độ GPS thời gian thực từ trình duyệt & Capacitor
 * Miễn phí 100% — dùng Browser Geolocation API + Capacitor Geolocation
 */

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number; // meters
  timestamp: number;
}

// Cache vị trí gần nhất để tránh gọi lại liên tục
let _cachedLocation: UserLocation | null = null;
let _cacheTimestamp = 0;
const CACHE_DURATION_MS = 60_000; // Cache 60 giây

/**
 * Lấy vị trí hiện tại của người dùng
 * Ưu tiên Capacitor native → fallback Browser API
 */
export const getCurrentLocation = async (
  options?: { timeout?: number; maxAge?: number }
): Promise<UserLocation> => {
  const timeout = options?.timeout || 10000;
  const maxAge = options?.maxAge || CACHE_DURATION_MS;

  // 1. Return cache nếu còn mới
  if (_cachedLocation && Date.now() - _cacheTimestamp < maxAge) {
    return _cachedLocation;
  }

  // 2. Try Capacitor Geolocation plugin (native, chính xác hơn)
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      // Dynamic import — may not be available in all builds
      const capGeoModuleName = '@capacitor/geolocation';
      const geoModule = await (Function('m', 'return import(m)')(capGeoModuleName)) as any;
      const pos = await geoModule.Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout,
      });
      const loc: UserLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      };
      _cachedLocation = loc;
      _cacheTimestamp = Date.now();
      return loc;
    }
  } catch (e) {
    console.warn('[Geolocation] Capacitor plugin not available, using browser API:', e);
  }

  // 3. Browser Geolocation API
  return new Promise<UserLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Trình duyệt không hỗ trợ định vị GPS.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: UserLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        _cachedLocation = loc;
        _cacheTimestamp = Date.now();
        resolve(loc);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error('Bạn đã từ chối quyền truy cập vị trí. Hãy bật Vị trí trong cài đặt trình duyệt.'));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error('Không thể xác định vị trí. Hãy kiểm tra kết nối GPS/WiFi.'));
            break;
          case err.TIMEOUT:
            reject(new Error('Hết thời gian chờ xác định vị trí. Thử lại sau.'));
            break;
          default:
            reject(new Error('Lỗi không xác định khi lấy vị trí.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout,
        maximumAge: maxAge,
      }
    );
  });
};

/**
 * Lấy cached location (không gọi API, trả về null nếu chưa có)
 */
export const getCachedLocation = (): UserLocation | null => {
  if (_cachedLocation && Date.now() - _cacheTimestamp < CACHE_DURATION_MS * 5) {
    return _cachedLocation;
  }
  return null;
};

/**
 * Tạo Google Maps search URL (miễn phí, mở Google Maps với kết quả search)
 */
export const buildGoogleMapsSearchUrl = (query: string, lat: number, lng: number): string => {
  const encodedQuery = encodeURIComponent(query);
  return `https://www.google.com/maps/search/${encodedQuery}/@${lat},${lng},15z`;
};

/**
 * Tạo Google Maps directions URL (miễn phí, mở chỉ đường đến đích)
 */
export const buildGoogleMapsDirectionsUrl = (
  destLat: number,
  destLng: number,
  destName?: string
): string => {
  const destination = destName
    ? encodeURIComponent(destName)
    : `${destLat},${destLng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
};

/**
 * Tạo Google Maps Place search URL
 */
export const buildGoogleMapsPlaceUrl = (
  query: string,
  lat: number,
  lng: number
): string => {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat},${lng},14z`;
};

/**
 * Tính khoảng cách giữa 2 điểm (Haversine formula) — trả về km
 */
export const calculateDistance = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Format khoảng cách cho hiển thị
 */
export const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
};

/**
 * Ước tính thời gian di chuyển (rough estimate)
 */
export const estimateTravelTime = (distanceKm: number, mode: 'driving' | 'walking' = 'driving'): string => {
  const speedKmH = mode === 'driving' ? 30 : 5; // Tốc độ trung bình đô thị
  const minutes = Math.round((distanceKm / speedKmH) * 60);
  if (minutes < 1) return 'dưới 1 phút';
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${mins}p` : `${hours} giờ`;
};

/**
 * Google Calendar Service
 * Đồng bộ 2 chiều với Google Calendar API v3
 * Sử dụng shared Google Auth Token Manager
 */

import { googleApiFetch, getValidGoogleToken } from './googleAuthTokenManager';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

// ────────────────────────────────────────
// Types
// ────────────────────────────────────────

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string; // For timed events (ISO 8601)
    date?: string;     // For all-day events (YYYY-MM-DD)
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: string;
  htmlLink?: string;
  created?: string;
  updated?: string;
  colorId?: string;
  recurrence?: string[];
  recurringEventId?: string;
  organizer?: { email: string; displayName?: string; self?: boolean };
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
}

// Local simplified event for UI
export interface CalendarEventLocal {
  id: string;
  googleEventId: string;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  startTime: string;   // ISO string
  endTime: string;      // ISO string
  isAllDay: boolean;
  color: string;
  htmlLink: string;
  isRecurring: boolean;
  status: string;
  updatedAt: string;
}

// ────────────────────────────────────────
// Local Storage Keys
// ────────────────────────────────────────
const STORAGE_KEYS = {
  SELECTED_CALENDARS: 'smartlife_gcal_selected_calendars',
  LAST_SYNC: 'smartlife_gcal_last_sync',
  CACHED_EVENTS: 'smartlife_gcal_cached_events',
  AUTO_SYNC: 'smartlife_gcal_auto_sync',
};

// ────────────────────────────────────────
// Calendar Colors mapping (Google Calendar color IDs)
// ────────────────────────────────────────
const CALENDAR_COLORS: Record<string, string> = {
  '1': '#7986cb', // Lavender
  '2': '#33b679', // Sage
  '3': '#8e24aa', // Grape
  '4': '#e67c73', // Flamingo
  '5': '#f6bf26', // Banana
  '6': '#f4511e', // Tangerine
  '7': '#039be5', // Peacock
  '8': '#616161', // Graphite
  '9': '#3f51b5', // Blueberry
  '10': '#0b8043', // Basil
  '11': '#d50000', // Tomato
};

// ────────────────────────────────────────
// Settings
// ────────────────────────────────────────

export const isCalendarAutoSyncEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC);
  return stored === null ? true : stored === 'true';
};

export const setCalendarAutoSync = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.AUTO_SYNC, enabled ? 'true' : 'false');
};

export const getLastCalendarSync = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
};

export const getSelectedCalendarIds = (): string[] => {
  if (typeof window === 'undefined') return ['primary'];
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_CALENDARS);
    if (stored) return JSON.parse(stored);
  } catch {}
  return ['primary'];
};

export const setSelectedCalendarIds = (ids: string[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SELECTED_CALENDARS, JSON.stringify(ids));
};

// ────────────────────────────────────────
// Connection Check
// ────────────────────────────────────────

export const isGoogleCalendarConnected = (): boolean => {
  return getValidGoogleToken() !== null;
};

// ────────────────────────────────────────
// API Functions
// ────────────────────────────────────────

/**
 * Lấy danh sách tất cả calendars của user
 */
export const listCalendars = async (): Promise<GoogleCalendar[]> => {
  const response = await googleApiFetch(
    `${CALENDAR_API_BASE}/users/me/calendarList?minAccessRole=reader`
  );
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Calendar API listCalendars error ${response.status}: ${err}`);
  }
  const data = await response.json();
  return (data.items || []).map((cal: any) => ({
    id: cal.id,
    summary: cal.summary || cal.id,
    description: cal.description || '',
    backgroundColor: cal.backgroundColor || '#4285f4',
    foregroundColor: cal.foregroundColor || '#ffffff',
    primary: cal.primary || false,
    selected: cal.selected || false,
    accessRole: cal.accessRole || 'reader',
  }));
};

/**
 * Lấy events trong khoảng thời gian
 */
export const listCalendarEvents = async (
  calendarId: string = 'primary',
  timeMin: string,
  timeMax: string,
  maxResults: number = 250
): Promise<GoogleCalendarEvent[]> => {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: maxResults.toString(),
  });

  const response = await googleApiFetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Calendar API listEvents error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.items || [];
};

/**
 * Tạo event mới
 */
export const createCalendarEvent = async (
  calendarId: string = 'primary',
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    recurrence?: string[];
    reminders?: { useDefault: boolean; overrides?: Array<{ method: string; minutes: number }> };
    colorId?: string;
  }
): Promise<GoogleCalendarEvent> => {
  const response = await googleApiFetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Calendar API createEvent error ${response.status}: ${err}`);
  }

  return response.json();
};

/**
 * Cập nhật event (PATCH — chỉ gửi fields cần thay đổi)
 */
export const updateCalendarEvent = async (
  calendarId: string = 'primary',
  eventId: string,
  updates: Partial<{
    summary: string;
    description: string;
    location: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    recurrence: string[];
    colorId: string;
    status: string;
  }>
): Promise<GoogleCalendarEvent> => {
  const response = await googleApiFetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Calendar API updateEvent error ${response.status}: ${err}`);
  }

  return response.json();
};

/**
 * Xóa event
 */
export const deleteCalendarEvent = async (
  calendarId: string = 'primary',
  eventId: string
): Promise<void> => {
  const response = await googleApiFetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' }
  );

  if (!response.ok && response.status !== 410) { // 410 = already deleted
    const err = await response.text();
    throw new Error(`Calendar API deleteEvent error ${response.status}: ${err}`);
  }
};

// ────────────────────────────────────────
// Mapper: Google Event → Local Event
// ────────────────────────────────────────

export const mapGoogleEventToLocal = (
  event: GoogleCalendarEvent,
  calendarId: string = 'primary',
  calendarColor: string = '#4285f4'
): CalendarEventLocal => {
  const isAllDay = !event.start.dateTime;

  let startTime: string;
  let endTime: string;

  if (isAllDay) {
    startTime = `${event.start.date}T00:00:00`;
    if (event.end.date) {
      // Google Calendar all-day event end.date is exclusive (+1 day)
      // Convert to inclusive end date
      const endD = new Date(`${event.end.date}T00:00:00`);
      endD.setDate(endD.getDate() - 1);
      const inclusiveEndStr = endD.toISOString().slice(0, 10);
      const safeEndStr = inclusiveEndStr >= event.start.date! ? inclusiveEndStr : event.start.date!;
      endTime = `${safeEndStr}T23:59:59`;
    } else {
      endTime = `${event.start.date}T23:59:59`;
    }
  } else {
    startTime = event.start.dateTime!;
    endTime = event.end.dateTime || event.start.dateTime!;
  }

  const color = event.colorId ? (CALENDAR_COLORS[event.colorId] || calendarColor) : calendarColor;

  return {
    id: `gcal_${event.id}`,
    googleEventId: event.id,
    calendarId,
    title: event.summary || '(Không có tiêu đề)',
    description: event.description || '',
    location: event.location || '',
    startTime,
    endTime,
    isAllDay,
    color,
    htmlLink: event.htmlLink || '',
    isRecurring: !!event.recurringEventId || !!(event.recurrence && event.recurrence.length > 0),
    status: event.status || 'confirmed',
    updatedAt: event.updated || new Date().toISOString(),
  };
};

// ────────────────────────────────────────
// Full Sync: Pull all events from selected calendars
// ────────────────────────────────────────

export interface CalendarSyncResult {
  events: CalendarEventLocal[];
  calendars: GoogleCalendar[];
  syncedAt: string;
  eventCount: number;
}

/**
 * Đồng bộ toàn bộ events từ Google Calendar
 * Kéo events từ -180 ngày đến +365 ngày (1 năm tới) với tối đa 2500 sự kiện mỗi calendar
 */
export const syncGoogleCalendar = async (
  selectedCalendarIds?: string[]
): Promise<CalendarSyncResult> => {
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - 180); // 6 tháng quá khứ
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + 365); // 1 năm tương lai

  // 1. Get all calendars
  let calendars: GoogleCalendar[] = [];
  try {
    calendars = await listCalendars();
  } catch (e) {
    console.warn('[GoogleCalendar] listCalendars error, falling back to primary:', e);
    calendars = [{ id: 'primary', summary: 'Primary', primary: true, selected: true }];
  }

  // 2. Determine which calendars to sync
  const calIds = selectedCalendarIds || getSelectedCalendarIds();
  let calendarsToSync: GoogleCalendar[] = [];
  
  if (calIds.length > 0 && !calIds.includes('primary')) {
    calendarsToSync = calendars.filter(c => calIds.includes(c.id));
  } else {
    // Sync all accessible calendars or primary/selected
    calendarsToSync = calendars.filter(c => c.primary || c.selected || c.accessRole === 'owner' || c.accessRole === 'writer' || c.accessRole === 'reader');
  }

  // If still empty, ensure primary is in
  if (calendarsToSync.length === 0) {
    const primary = calendars.find(c => c.primary) || calendars[0];
    if (primary) calendarsToSync.push(primary);
    else calendarsToSync.push({ id: 'primary', summary: 'Primary', primary: true, selected: true });
  }

  // 3. Fetch events from each calendar in parallel (up to 2500 events per calendar)
  const allEventsMap = new Map<string, CalendarEventLocal>();

  const promises = calendarsToSync.map(async (cal) => {
    try {
      const events = await listCalendarEvents(
        cal.id,
        timeMin.toISOString(),
        timeMax.toISOString(),
        2500
      );
      return events
        .filter(e => e.status !== 'cancelled')
        .map(e => mapGoogleEventToLocal(e, cal.id, cal.backgroundColor));
    } catch (err) {
      console.warn(`[GoogleCalendar] Failed to sync calendar "${cal.summary} (${cal.id})":`, err);
      return [];
    }
  });

  const results = await Promise.all(promises);
  results.forEach(events => {
    events.forEach(evt => {
      // Deduplicate by googleEventId
      allEventsMap.set(evt.googleEventId || evt.id, evt);
    });
  });

  const allEvents = Array.from(allEventsMap.values());

  // Sort by start time
  allEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const syncedAt = new Date().toISOString();

  // Cache results
  try {
    localStorage.setItem(STORAGE_KEYS.CACHED_EVENTS, JSON.stringify(allEvents));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, syncedAt);
  } catch (e) {
    console.warn('[GoogleCalendar] Failed to cache events:', e);
  }

  return {
    events: allEvents,
    calendars,
    syncedAt,
    eventCount: allEvents.length,
  };
};

/**
 * Lấy cached events từ localStorage (hiển thị ngay lập tức khi chưa sync xong)
 */
export const getCachedCalendarEvents = (): CalendarEventLocal[] => {
  if (typeof window === 'undefined') return [];
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.CACHED_EVENTS);
    if (cached) return JSON.parse(cached);
  } catch {}
  return [];
};

// ────────────────────────────────────────
// Helper: Create event from simple params (cho AI function calling & UI form)
// ────────────────────────────────────────

export const createEventFromSimpleParams = async (params: {
  title: string;
  date: string;        // YYYY-MM-DD
  time?: string;       // HH:mm
  endTime?: string;    // HH:mm
  description?: string;
  location?: string;
  calendarId?: string;
  reminderMinutes?: number;
}): Promise<CalendarEventLocal> => {
  const { title, date, time, endTime, description, location, calendarId = 'primary', reminderMinutes } = params;

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let start: { dateTime?: string; date?: string; timeZone?: string };
  let end: { dateTime?: string; date?: string; timeZone?: string };

  if (time) {
    const startDT = `${date}T${time}:00`;
    const endDT = endTime
      ? `${date}T${endTime}:00`
      : (() => {
          // Default 1 hour later
          const d = new Date(`${date}T${time}:00`);
          d.setHours(d.getHours() + 1);
          return d.toISOString().slice(0, 19);
        })();

    start = { dateTime: startDT, timeZone };
    end = { dateTime: endDT, timeZone };
  } else {
    // All-day event
    start = { date };
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    end = { date: nextDay.toISOString().slice(0, 10) };
  }

  const eventBody: any = {
    summary: title,
    start,
    end,
  };
  if (description) eventBody.description = description;
  if (location) eventBody.location = location;
  if (reminderMinutes !== undefined) {
    eventBody.reminders = {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: reminderMinutes }],
    };
  }

  const created = await createCalendarEvent(calendarId, eventBody);
  return mapGoogleEventToLocal(created, calendarId);
};

/**
 * Helper: Lấy events cho 1 ngày cụ thể từ cache
 */
export const getEventsForDate = (
  events: CalendarEventLocal[],
  dateStr: string // YYYY-MM-DD
): CalendarEventLocal[] => {
  const targetDate = dateStr.slice(0, 10);
  return events.filter(e => {
    const eventDate = e.startTime.slice(0, 10);
    const eventEndDate = e.endTime.slice(0, 10);
    return eventDate <= targetDate && eventEndDate >= targetDate;
  });
};

/**
 * Helper: Lấy events cho 1 tuần
 */
export const getEventsForWeek = (
  events: CalendarEventLocal[],
  weekStart: Date // Monday
): CalendarEventLocal[] => {
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return events.filter(e => {
    const eventStart = new Date(e.startTime);
    const eventEnd = new Date(e.endTime);
    return eventStart < end && eventEnd > start;
  });
};

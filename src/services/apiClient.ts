// src/services/apiClient.ts
import { supabase } from './supabase';

const API_BASE_URL = '/api';

export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    // Lấy session hiện tại
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const headers = new Headers(options.headers);

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    // Mặc định Content-Type là application/json nếu không phải FormData
    if (!(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        // Thử lấy thông báo lỗi chi tiết từ server
        let errorMessage = `HTTP Error: ${response.status}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorMessage;
        } catch (e) { /* ignore */ }
        throw new Error(errorMessage);
    }

    return response.json();
};

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const isNetworkError = (error: any): boolean => {
    if (!error) return false;
    const msg = String(error.message || error).toLowerCase();
    return (
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('timeout') ||
        msg.includes('connection') ||
        msg.includes('load failed') ||
        msg.includes('status 0') ||
        msg.includes('offline')
    );
};

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
    signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ error: any; data: any }>;
    resetPassword: (email: string) => Promise<{ error: any }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function withTimeout<T>(promise: Promise<T>, timeoutMs = 6000): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Auth Timeout')), timeoutMs)
        )
    ]);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        let authSubscription: { unsubscribe: () => void } | null = null;
        let deepLinkListener: any = null;

        const initializeAuth = async () => {
            // 1. Read local cached session first for instant-on startup
            try {
                const { value } = await Preferences.get({ key: 'smartlife_cached_session' });
                if (value && isMounted) {
                    const cachedSession = JSON.parse(value);
                    if (cachedSession && cachedSession.user) {
                        console.log('[AuthContext] Restoring cached session:', cachedSession.user.email);
                        setSession(cachedSession);
                        setUser(cachedSession.user);
                        setLoading(false); // Render the authenticated UI immediately!
                    }
                }
            } catch (e) {
                console.error('[AuthContext] Failed to read cached session:', e);
            }

            // 2. Perform verification with Supabase
            try {
                console.log('[AuthContext] Verifying session with Supabase...');
                const { data: { session: freshSession } } = await withTimeout(supabase.auth.getSession(), 6000);
                
                if (isMounted) {
                    if (freshSession) {
                        console.log('[AuthContext] Supabase verification success:', freshSession.user.email);
                        setSession(freshSession);
                        setUser(freshSession.user);
                        await Preferences.set({
                            key: 'smartlife_cached_session',
                            value: JSON.stringify(freshSession)
                        });
                    } else {
                        console.log('[AuthContext] No active session found on Supabase.');
                        setSession(null);
                        setUser(null);
                        await Preferences.remove({ key: 'smartlife_cached_session' });
                    }
                }
            } catch (error: any) {
                console.error('[AuthContext] Supabase getSession error:', error);
                
                // If it's a network issue or timeout, preserve the cached session
                if (isNetworkError(error)) {
                    console.warn('[AuthContext] Network/Timeout error, retaining cached session for offline use.');
                } else {
                    // Actual authentication failure (e.g. revoked token), clear the state
                    if (isMounted) {
                        setSession(null);
                        setUser(null);
                    }
                    await Preferences.remove({ key: 'smartlife_cached_session' });
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }

            // 3. Subscribe to auth state changes for subsequent events
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('[AuthContext] Supabase auth state change:', event, session?.user?.email);
                
                if (!isMounted) return;

                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    setSession(session);
                    setUser(session?.user ?? null);
                    if (session) {
                        await Preferences.set({
                            key: 'smartlife_cached_session',
                            value: JSON.stringify(session)
                        });
                    }
                } else if (event === 'SIGNED_OUT') {
                    setSession(null);
                    setUser(null);
                    await Preferences.remove({ key: 'smartlife_cached_session' });
                } else if (event === 'USER_UPDATED') {
                    setUser(session?.user ?? null);
                    if (session) {
                        await Preferences.set({
                            key: 'smartlife_cached_session',
                            value: JSON.stringify(session)
                        });
                    }
                }
                // Notice: We don't handle 'INITIAL_SESSION' here to prevent the race condition
                // where the initial load triggers with null session before getSession/Preferences has loaded.
            });

            if (isMounted) {
                authSubscription = subscription;
            } else {
                subscription.unsubscribe();
            }
        };

        // 4. Handle Capacitor Deep Link redirects for Google/OAuth SSO
        const setupDeepLinks = async () => {
            if (Capacitor.isNativePlatform()) {
                try {
                    const { App: CapApp } = await import('@capacitor/app');
                    if (!isMounted) return;

                    deepLinkListener = await CapApp.addListener('appUrlOpen', async (event: any) => {
                        console.log('[AuthContext] Native app opened via deep link:', event.url);
                        
                        // Parse oauth parameters from hash or search query
                        // Format example: com.smartlife.app://supabase-auth#access_token=...&refresh_token=...
                        if (event.url && (event.url.includes('access_token=') || event.url.includes('refresh_token='))) {
                            try {
                                // Convert hash fragment '#' to query parameter '?' to parse easily
                                const parseableUrl = event.url.replace('#', '?');
                                const url = new URL(parseableUrl);
                                const accessToken = url.searchParams.get('access_token');
                                const refreshToken = url.searchParams.get('refresh_token');
                                
                                if (accessToken && refreshToken) {
                                    console.log('[AuthContext] Extracting session from deep link...');
                                    setLoading(true);
                                    
                                    const { data, error } = await supabase.auth.setSession({
                                        access_token: accessToken,
                                        refresh_token: refreshToken
                                    });
                                    
                                    if (error) throw error;
                                    
                                    if (data?.session && isMounted) {
                                        console.log('[AuthContext] Session successfully set from deep link.');
                                        setSession(data.session);
                                        setUser(data.session.user);
                                        await Preferences.set({
                                            key: 'smartlife_cached_session',
                                            value: JSON.stringify(data.session)
                                        });
                                    }
                                }
                            } catch (err) {
                                console.error('[AuthContext] Failed to parse and set session from deep link:', err);
                            } finally {
                                if (isMounted) {
                                    setLoading(false);
                                }
                            }
                        }
                    });
                } catch (err) {
                    console.error('[AuthContext] Failed to load @capacitor/app plugin:', err);
                }
            }
        };

        initializeAuth();
        setupDeepLinks();

        return () => {
            isMounted = false;
            if (authSubscription) {
                authSubscription.unsubscribe();
            }
            if (deepLinkListener) {
                deepLinkListener.remove();
            }
        };
    }, []);

    const signInWithGoogle = async () => {
        try {
            let redirectUrl = window.location.origin;

            // Check if we are running in a native Capacitor environment (iOS or Android)
            if (Capacitor.isNativePlatform()) {
                redirectUrl = 'com.smartlife.app://supabase-auth';
            }

            console.log('Starting Google Sign-in with redirect to:', redirectUrl);

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });
            if (error) throw error;
        } catch (error: any) {
            console.error('Error signing in with Google:', error);
            alert(`Lỗi đăng nhập Google: ${error.message || JSON.stringify(error)}.`);
        }
    };

    const signInWithEmail = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
    };

    const signUpWithEmail = async (email: string, password: string, fullName: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
                emailRedirectTo: window.location.origin,
            },
        });
        return { data, error };
    };

    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        });
        return { error };
    };

    const signOut = async () => {
        try {
            localStorage.setItem('smartlife_logged_out_flag', 'true');
            await Preferences.remove({ key: 'smartlife_cached_session' });
            const { error } = await supabase.auth.signOut();
            if (error) console.error('Supabase signout error:', error);
        } catch (error) {
            console.error('Error signing out:', error);
        } finally {
            setUser(null);
            setSession(null);
            window.location.href = '/';
        }
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

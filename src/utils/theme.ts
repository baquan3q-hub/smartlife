import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'smartlife_theme';

export function getSavedTheme(): ThemeMode {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
    }
    return 'system';
}

export function saveTheme(theme: ThemeMode) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    // Dispatch custom event to notify other components/instances
    window.dispatchEvent(new CustomEvent('smartlife_theme_change', { detail: theme }));
}

export function applyTheme(theme: ThemeMode) {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
    } else if (theme === 'light') {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
    } else {
        // system theme
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
            root.classList.add('dark');
            root.style.colorScheme = 'dark';
        } else {
            root.classList.remove('dark');
            root.style.colorScheme = 'light';
        }
    }
}

export function useTheme() {
    const [theme, setThemeState] = useState<ThemeMode>(getSavedTheme);

    const changeTheme = (newTheme: ThemeMode) => {
        saveTheme(newTheme);
        applyTheme(newTheme);
        setThemeState(newTheme);
    };

    useEffect(() => {
        // Initial application
        applyTheme(theme);

        // Listen for preferences changes if we are on 'system' mode
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemThemeChange = () => {
            if (getSavedTheme() === 'system') {
                applyTheme('system');
            }
        };

        // Listen for changes from other tabs or settings modal saves
        const handleCustomEvent = (e: Event) => {
            const customEvent = e as CustomEvent<ThemeMode>;
            setThemeState(customEvent.detail || getSavedTheme());
        };

        const handleStorageEvent = (e: StorageEvent) => {
            if (e.key === THEME_STORAGE_KEY) {
                const val = e.newValue as ThemeMode;
                if (val) {
                    setThemeState(val);
                    applyTheme(val);
                }
            }
        };

        // Modern browsers support addEventListener
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleSystemThemeChange);
        } else {
            mediaQuery.addListener(handleSystemThemeChange);
        }

        window.addEventListener('smartlife_theme_change', handleCustomEvent as EventListener);
        window.addEventListener('storage', handleStorageEvent);

        return () => {
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', handleSystemThemeChange);
            } else {
                mediaQuery.removeListener(handleSystemThemeChange);
            }
            window.removeEventListener('smartlife_theme_change', handleCustomEvent as EventListener);
            window.removeEventListener('storage', handleStorageEvent);
        };
    }, [theme]);

    return { theme, changeTheme };
}

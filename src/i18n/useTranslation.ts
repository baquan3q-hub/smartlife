import { useCallback } from 'react';
import { Lang, t as translate } from './i18n';

export const useTranslation = (lang: Lang) => {
    const t = useCallback((key: string) => translate(key, lang), [lang]);
    return { t, lang };
};

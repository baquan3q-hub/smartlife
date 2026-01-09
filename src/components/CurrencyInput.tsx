import React, { useRef, useLayoutEffect, useState } from 'react';

interface CurrencyInputProps {
    value: number | string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
    required?: boolean;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, placeholder, className, autoFocus, required }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const format = (val: string | number) => {
        if (val === '' || val === undefined || val === null) return '';
        const num = Number(val);
        if (isNaN(num)) return '';
        return new Intl.NumberFormat('vi-VN').format(num);
    };

    const displayValue = format(value);

    // REVISED STRATEGY:
    // Just use a simpler handler that doesn't fight the user too much.
    // The issue reported "nhảy chữ" is usually because the value prop replaces the input entirely.

    // Let's implement the "Digits Before Cursor" tracking strategy via a wrapper.
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target;
        const val = input.value;
        const selectionStart = input.selectionStart || 0;

        // Count digits before cursor
        const digitsBeforeCursor = val.slice(0, selectionStart).replace(/\D/g, '').length;

        const raw = val.replace(/\D/g, '');

        onChange(raw);

        // We will restore cursor in layout effect
        // Store the target "digits before cursor" count
        // We use a ref for this to avoid re-renders or stale closures problems if possible
        // But `useEffect` depends on `displayValue` changing.

        (inputRef.current as any)._digitsBeforeCursor = digitsBeforeCursor;
    };

    useLayoutEffect(() => {
        if (inputRef.current) {
            const input = inputRef.current;
            const digitsBeforeCursor = (input as any)._digitsBeforeCursor;

            if (digitsBeforeCursor !== undefined) {
                const formatted = input.value;
                let currentDigits = 0;
                let finalPos = 0;

                // Scan the formatted string to find the position that corresponds 
                // to the same number of digits we had before
                for (let i = 0; i < formatted.length; i++) {
                    if (/\d/.test(formatted[i])) {
                        currentDigits++;
                    }
                    if (currentDigits === digitsBeforeCursor && /\d/.test(formatted[i])) {
                        // Found the Nth digit. Cursor should be after it.
                        finalPos = i + 1;
                        break;
                    }
                }

                // Edge case: if digitsBeforeCursor is 0, cursor at start
                if (digitsBeforeCursor === 0) finalPos = 0;

                // Edge case: if we are at the end (e.g. user typed a number that got appended)
                // The loop breaks after finding the digit.

                // Restore cursor
                input.setSelectionRange(finalPos, finalPos);
                (input as any)._digitsBeforeCursor = undefined;
            }
        }
    }, [displayValue]);

    return (
        <input
            ref={inputRef}
            type="text" // Must be text for multiple separators
            value={displayValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            className={className}
            autoFocus={autoFocus}
            required={required}
        />
    );
};

export default CurrencyInput;
function useEffect(arg0: () => void, arg1: any[]) {
    throw new Error('Function not implemented.');
}


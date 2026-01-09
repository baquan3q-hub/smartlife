import React, { useState, useEffect } from 'react';
import { Delete, X, Check, RotateCw } from 'lucide-react';

interface CalculatorProps {
    initialValue?: string;
    onComplete: (value: string) => void;
    onClose: () => void;
}

const Calculator: React.FC<CalculatorProps> = ({ initialValue = '0', onComplete, onClose }) => {
    const [display, setDisplay] = useState(initialValue === '' ? '0' : initialValue);
    const [equation, setEquation] = useState(''); // Visual history: "500 + 200"

    const handleNumber = (num: string) => {
        setDisplay(prev => {
            if (prev === '0' || prev === 'Error') return num;
            return prev + num;
        });
    };

    const handleOperator = (op: string) => {
        setEquation(display + ' ' + op + ' ');
        setDisplay('0');
    };

    const handleDecimal = () => {
        if (!display.includes('.')) {
            setDisplay(prev => prev + '.');
        }
    };

    const handleClear = () => {
        setDisplay('0');
        setEquation('');
    };

    const handleDelete = () => {
        setDisplay(prev => {
            if (prev.length === 1 || prev === 'Error') return '0';
            return prev.slice(0, -1);
        });
    };

    const handleCalculate = () => {
        if (!equation) return;
        try {
            // Safety check: ensure equation ONLY contains numbers and operators
            const fullExpr = equation + display;
            if (!/^[\d\.\s\+\-\*\/%]+$/.test(fullExpr)) {
                setDisplay('Error');
                return;
            }

            // Using Function constructor as a safer eval alternative for simple math
            // eslint-disable-next-line
            const result = new Function('return ' + fullExpr)();
            const resultStr = String(result);

            // Handle Infinity/NaN
            if (!isFinite(result)) {
                setDisplay('Error');
            } else {
                setDisplay(resultStr);
            }
            setEquation('');
        } catch (e) {
            setDisplay('Error');
        }
    };

    const handleComplete = () => {
        // If there's a pending calculation, calculate it first
        if (equation) {
            try {
                const fullExpr = equation + display;
                // eslint-disable-next-line
                const result = new Function('return ' + fullExpr)();
                if (isFinite(result)) {
                    onComplete(String(result));
                    return;
                }
            } catch (e) {
                // ignore
            }
        }

        if (display === 'Error') {
            onComplete('0');
        } else {
            onComplete(display);
        }
    };

    const formatDisplay = (val: string) => {
        if (val === 'Error') return val;
        // Allows typing '500.' without it stripping the dot
        if (val.endsWith('.')) {
            return new Intl.NumberFormat('vi-VN').format(Number(val.slice(0, -1))) + '.';
        }
        // Handle in-progress typing (e.g. 0.5)
        return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 10 }).format(Number(val));
    };

    // --- Keyboard Support ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key;
            if (/\d/.test(key)) handleNumber(key);
            if (key === '.') handleDecimal();
            if (key === '+' || key === '-') handleOperator(key);
            if (key === '*') handleOperator('*');
            if (key === '/') handleOperator('/');
            if (key === 'Enter') {
                e.preventDefault();
                if (equation) handleCalculate();
                else handleComplete();
            }
            if (key === 'Backspace') handleDelete();
            if (key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [display, equation]);

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-indigo-100 overflow-hidden animate-slide-up w-full max-w-sm mx-auto">
            {/* Header / Display */}
            <div className="bg-indigo-600 p-4 text-white">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-indigo-200 text-xs font-medium h-4">{equation}</span>
                    <button onClick={onClose}><X size={18} className="text-indigo-200 hover:text-white" /></button>
                </div>
                <div className="text-right text-4xl font-bold tracking-tight truncate h-12 flex items-center justify-end">
                    {formatDisplay(display)}
                </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-4 gap-px bg-gray-100 p-px">
                {/* Row 1 */}
                <button onClick={handleClear} className="bg-gray-50 hover:bg-white p-4 text-red-500 font-bold transition-colors">AC</button>
                <button onClick={handleDelete} className="bg-gray-50 hover:bg-white p-4 text-gray-700 transition-colors flex items-center justify-center"><Delete size={20} /></button>
                <button onClick={() => handleOperator('%')} className="bg-gray-50 hover:bg-white p-4 text-indigo-600 font-bold transition-colors">%</button>
                <button onClick={() => handleOperator('/')} className="bg-indigo-50 hover:bg-indigo-100 p-4 text-indigo-600 font-bold text-xl transition-colors">÷</button>

                {/* Row 2 */}
                <button onClick={() => handleNumber('7')} className="bg-white hover:bg-gray-50 p-4 text-gray-800 font-semibold text-lg transition-colors">7</button>
                <button onClick={() => handleNumber('8')} className="bg-white hover:bg-gray-50 p-4 text-gray-800 font-semibold text-lg transition-colors">8</button>
                <button onClick={() => handleNumber('9')} className="bg-white hover:bg-gray-50 p-4 text-gray-800 font-semibold text-lg transition-colors">9</button>
                <button onClick={() => handleOperator('*')} className="bg-indigo-50 hover:bg-indigo-100 p-4 text-indigo-600 font-bold text-xl transition-colors">×</button>

                {/* Row 3 */}
                <button onClick={() => handleNumber('4')} className="bg-white hover:bg-gray-50 p-4 text-gray-800 font-semibold text-lg transition-colors">4</button>
                <button onClick={() => handleNumber('5')} className="bg-white hover:bg-gray-50 p-4 text-gray-800 font-semibold text-lg transition-colors">5</button>
                <button onClick={() => handleNumber('6')} className="bg-white hover:bg-gray-50 p-4 text-gray-800 font-semibold text-lg transition-colors">6</button>
                <button onClick={() => handleOperator('-')} className="bg-indigo-50 hover:bg-indigo-100 p-4 text-indigo-600 font-bold text-xl transition-colors">-</button>

                {/* Row 4 */}
                <button onClick={() => handleNumber('1')} className="bg-white hover:bg-gray-50 p-4 text-gray-800 font-semibold text-lg transition-colors">1</button>
                <button onClick={() => handleNumber('2')} className="bg-white hover:bg-gray-50 p-4 text-gray-800 font-semibold text-lg transition-colors">2</button>
                <button onClick={() => handleNumber('3')} className="bg-white hover:bg-gray-50 p-4 text-gray-800 font-semibold text-lg transition-colors">3</button>
                <button onClick={() => handleOperator('+')} className="bg-indigo-50 hover:bg-indigo-100 p-4 text-indigo-600 font-bold text-xl transition-colors">+</button>

                {/* Row 5 */}
                <button onClick={() => handleNumber('0')} className="bg-white hover:bg-gray-50 p-4 text-gray-800 font-semibold text-lg transition-colors col-span-2">0</button>
                <button onClick={handleDecimal} className="bg-white hover:bg-gray-50 p-4 text-gray-800 font-bold text-xl transition-colors">.</button>
                <button onClick={handleCalculate} className="bg-indigo-600 hover:bg-indigo-700 p-4 text-white font-bold text-xl transition-colors shadow-inner">=</button>
            </div>

            {/* Complete Button */}
            <button
                onClick={handleComplete}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 uppercase tracking-wider text-sm transition-colors flex items-center justify-center gap-2"
            >
                <Check size={18} />
                Hoàn thành
            </button>
        </div>
    );
};

export default Calculator;

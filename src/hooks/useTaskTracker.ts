import { useState, useEffect } from 'react';
import { Todo } from '../types';

export const useTaskTracker = (onSaveTimeSpent?: (todoId: string, secondsSpent: number) => void) => {
    const [activeTask, setActiveTask] = useState<Todo | null>(() => {
        const saved = localStorage.getItem('task_tracker_active_todo');
        try {
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'PAUSED'>(() => {
        const saved = localStorage.getItem('task_tracker_status');
        return (saved as any) || 'IDLE';
    });

    const [elapsedTime, setElapsedTime] = useState<number>(() => {
        const savedStatus = localStorage.getItem('task_tracker_status') || 'IDLE';
        const savedAccumulated = parseInt(localStorage.getItem('task_tracker_accumulated') || '0', 10);
        const savedStartTime = parseInt(localStorage.getItem('task_tracker_start_time') || '0', 10);

        if (savedStatus === 'RUNNING' && savedStartTime > 0) {
            const elapsed = Math.floor((Date.now() - savedStartTime) / 1000);
            return savedAccumulated + elapsed;
        }
        return savedAccumulated;
    });

    // Sync activeTask to LocalStorage
    useEffect(() => {
        if (activeTask) {
            localStorage.setItem('task_tracker_active_todo', JSON.stringify(activeTask));
        } else {
            localStorage.removeItem('task_tracker_active_todo');
        }
    }, [activeTask]);

    // Sync status to LocalStorage
    useEffect(() => {
        localStorage.setItem('task_tracker_status', status);
    }, [status]);

    // Timer effect
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (status === 'RUNNING') {
            interval = setInterval(() => {
                const savedStartTime = parseInt(localStorage.getItem('task_tracker_start_time') || '0', 10);
                const savedAccumulated = parseInt(localStorage.getItem('task_tracker_accumulated') || '0', 10);
                
                if (savedStartTime > 0) {
                    const elapsed = Math.floor((Date.now() - savedStartTime) / 1000);
                    setElapsedTime(savedAccumulated + elapsed);
                }
            }, 500);
        }

        return () => clearInterval(interval);
    }, [status]);

    const startTracking = (todo: Todo) => {
        // If clicking a different task, save the time of the current active task first
        if (activeTask && activeTask.id !== todo.id) {
            const finalTime = stopAndGetTime();
            if (finalTime > 0 && onSaveTimeSpent) {
                onSaveTimeSpent(activeTask.id, finalTime);
            }
        }

        setActiveTask(todo);
        setStatus('RUNNING');
        setElapsedTime(0);
        localStorage.setItem('task_tracker_accumulated', '0');
        localStorage.setItem('task_tracker_start_time', Date.now().toString());
    };

    const pauseTracking = () => {
        if (status !== 'RUNNING') return;
        
        const savedStartTime = parseInt(localStorage.getItem('task_tracker_start_time') || '0', 10);
        const savedAccumulated = parseInt(localStorage.getItem('task_tracker_accumulated') || '0', 10);
        const currentElapsed = Math.floor((Date.now() - savedStartTime) / 1000);
        const newAccumulated = savedAccumulated + currentElapsed;

        setStatus('PAUSED');
        localStorage.setItem('task_tracker_accumulated', newAccumulated.toString());
        localStorage.removeItem('task_tracker_start_time');
        setElapsedTime(newAccumulated);
    };

    const resumeTracking = () => {
        if (status !== 'PAUSED' || !activeTask) return;

        setStatus('RUNNING');
        localStorage.setItem('task_tracker_start_time', Date.now().toString());
    };

    const stopAndGetTime = (): number => {
        const savedStatus = localStorage.getItem('task_tracker_status') || 'IDLE';
        const savedAccumulated = parseInt(localStorage.getItem('task_tracker_accumulated') || '0', 10);
        let finalTime = savedAccumulated;

        if (savedStatus === 'RUNNING') {
            const savedStartTime = parseInt(localStorage.getItem('task_tracker_start_time') || '0', 10);
            if (savedStartTime > 0) {
                finalTime += Math.floor((Date.now() - savedStartTime) / 1000);
            }
        }

        // Clear everything
        setActiveTask(null);
        setStatus('IDLE');
        setElapsedTime(0);
        localStorage.removeItem('task_tracker_active_todo');
        localStorage.removeItem('task_tracker_status');
        localStorage.removeItem('task_tracker_start_time');
        localStorage.removeItem('task_tracker_accumulated');

        return finalTime;
    };

    const completeTracking = () => {
        if (!activeTask) return 0;
        const todoId = activeTask.id;
        const totalTimeSpent = stopAndGetTime();
        
        if (onSaveTimeSpent) {
            onSaveTimeSpent(todoId, totalTimeSpent);
        }
        return totalTimeSpent;
    };

    const cancelTracking = () => {
        setActiveTask(null);
        setStatus('IDLE');
        setElapsedTime(0);
        localStorage.removeItem('task_tracker_active_todo');
        localStorage.removeItem('task_tracker_status');
        localStorage.removeItem('task_tracker_start_time');
        localStorage.removeItem('task_tracker_accumulated');
    };

    return {
        activeTask,
        status,
        elapsedTime,
        isTracking: status === 'RUNNING',
        startTracking,
        pauseTracking,
        resumeTracking,
        completeTracking,
        cancelTracking,
        setActiveTask // Expose setter so we can update info if needed (e.g. if the item list updates)
    };
};

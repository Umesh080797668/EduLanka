import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
    text?: string;
    fullScreen?: boolean;
}

export function Spinner({ text = 'Loading...', fullScreen = false }: SpinnerProps) {
    const content = (
        <div className="flex flex-col items-center justify-center space-y-4 text-indigo-600 p-8">
            <Loader2 className="w-10 h-10 animate-spin" strokeWidth={2.5} />
            <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{text}</p>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] w-full">
                {content}
            </div>
        );
    }

    return content;
}

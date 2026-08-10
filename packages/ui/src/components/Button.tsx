import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', size = 'md', ...props }, ref) => {
        const baseClass = 'inline-flex items-center justify-center rounded font-medium focus:outline-none transition-colors';
        const variants = {
            primary: 'bg-blue-600 text-white hover:bg-blue-700',
            secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
            danger: 'bg-red-600 text-white hover:bg-red-700',
        };
        const sizes = {
            sm: 'px-3 py-1.5 text-sm',
            md: 'px-4 py-2 text-base',
            lg: 'px-6 py-3 text-lg',
        };

        const finalClass = `${baseClass} ${variants[variant]} ${sizes[size]} ${className}`;

        return (
            <button ref={ref} className={finalClass.trim()} {...props} />
        );
    }
);
Button.displayName = 'Button';

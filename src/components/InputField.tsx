import React from 'react';

// Interface de props reutilizável, estendendo os atributos de input padrão
interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    name: string;
    isLoading?: boolean;
    error?: string | null;
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
    ({ label, name, isLoading = false, error, ...props }, ref) => {
        // Define as classes de estilo base e de erro usando TailwindCSS
        const baseClasses = "mt-1 block w-full px-3 py-2 border rounded-md shadow-sm bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 focus:outline-none focus:ring-2 disabled:bg-slate-100 dark:disabled:bg-slate-700/50 disabled:cursor-not-allowed";
        const errorClasses = "border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500";
        const normalClasses = "focus:ring-indigo-500 focus:border-indigo-500";
        
        // Combina as classes com base na existência de um erro
        const finalClasses = `${baseClasses} ${error ? errorClasses : normalClasses}`;
        
        return (
            <div>
                <label htmlFor={name} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
                <div className="relative">
                    <input
                        id={name}
                        name={name}
                        ref={ref}
                        disabled={isLoading}
                        className={finalClasses}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${name}-error` : undefined}
                        {...props}
                    />
                    {/* Exibe um ícone de carregamento dentro do campo */}
                    {isLoading && (
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    )}
                </div>
                 {/* Exibe a mensagem de erro abaixo do campo */}
                {error && <p id={`${name}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
            </div>
        )
    }
);

InputField.displayName = 'InputField';

export default InputField;

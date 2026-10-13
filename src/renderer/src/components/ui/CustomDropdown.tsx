import React, { useEffect, useRef, useState } from 'react'

export interface DropdownOption<T extends string> {
    value: T
    label: string
}

interface CustomDropdownProps<T extends string> {
    value: T
    options: DropdownOption<T>[]
    onChange: (value: T) => void
    prefixLabel?: string
}

export function CustomDropdown<T extends string>({
    value,
    options,
    onChange,
    prefixLabel
}: CustomDropdownProps<T>): React.JSX.Element {
    const [isOpen, setIsOpen] = useState<boolean>(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedOption = options.find((o) => o.value === value) || options[0]

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent): void => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={containerRef} className="relative z-30 inline-block text-left">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="cursor-pointer flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] shadow-xs transition-all hover:border-[var(--border-highlight)] hover:bg-[var(--bg-surface)]"
            >
                {prefixLabel && (
                    <span className="text-[var(--text-secondary)] font-normal">{prefixLabel}</span>
                )}
                <span>{selectedOption?.label}</span>
                <svg
                    className={`h-3 w-3 text-[var(--text-secondary)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
                        }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1.5 w-48 max-h-56 overflow-y-auto origin-top-right rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-1.5 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 z-50">
                    {options.map((option) => {
                        const isSelected = option.value === value
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value)
                                    setIsOpen(false)
                                }}
                                className={`cursor-pointer flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${isSelected
                                    ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat font-bold text-white shadow-xs'
                                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                                    }`}
                            >
                                <span>{option.label}</span>
                                {isSelected && (
                                    <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
import React, { useEffect, useState } from 'react'

export const WindowControls: React.FC = () => {
    const [isMaximized, setIsMaximized] = useState<boolean>(false)

    useEffect(() => {
        window.api?.isMaximized?.().then((max: boolean) => {
            setIsMaximized(Boolean(max))
        })

        const unsubscribe = window.api?.onWindowStateChanged?.((state: { isMaximized: boolean }) => {
            setIsMaximized(state.isMaximized)
        })

        return () => unsubscribe?.()
    }, [])

    const handleMinimize = async (): Promise<void> => {
        await window.api?.minimizeWindow?.()
    }

    const handleMaximize = async (): Promise<void> => {
        const max = await window.api?.maximizeWindow?.()
        setIsMaximized(Boolean(max))
    }

    const handleClose = async (): Promise<void> => {
        await window.api?.closeWindow?.()
    }

    return (
        <div className="window-no-drag flex items-center gap-2">
            {/* Minimize */}
            <button
                type="button"
                onClick={handleMinimize}
                title="Minimize"
                aria-label="Minimize Window"
                className="group relative flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-full bg-amber-400/80 transition-all duration-200 hover:scale-110 hover:bg-amber-400 focus:outline-none shadow-xs"
            >
                <svg
                    viewBox="0 0 10 2"
                    className="h-1.5 w-1.5 fill-amber-950"
                >
                    <rect width="10" height="2" rx="1" />
                </svg>
            </button>

            {/* Maximize / Restore */}
            <button
                type="button"
                onClick={handleMaximize}
                title={isMaximized ? 'Restore' : 'Maximize'}
                aria-label="Toggle Maximize Window"
                className="group relative flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-full bg-emerald-400/80 transition-all duration-200 hover:scale-110 hover:bg-emerald-400 focus:outline-none shadow-xs"
            >
                <svg
                    viewBox="0 0 10 10"
                    className="h-1.5 w-1.5 fill-emerald-950"
                >
                    {isMaximized ? (
                        <path d="M2 4V2h2V0H0v4h2zm6 2v2H6v2h4V6H8zM8 2h2V0H6v2h2v2h2V2H8zm-6 6H0v2h4V8H2V6H0v2h2z" />
                    ) : (
                        <path d="M1 1h8v8H1V1zm1 1v6h6V2H2z" />
                    )}
                </svg>
            </button>

            {/* Close */}
            <button
                type="button"
                onClick={handleClose}
                title="Close"
                aria-label="Close Window"
                className="group relative flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-full bg-rose-500/80 transition-all duration-200 hover:scale-110 hover:bg-rose-500 focus:outline-none shadow-xs"
            >
                <svg
                    viewBox="0 0 10 10"
                    className="h-1.5 w-1.5 fill-rose-950"
                >
                    <path d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4-4-4z" />
                </svg>
            </button>
        </div>
    )
}
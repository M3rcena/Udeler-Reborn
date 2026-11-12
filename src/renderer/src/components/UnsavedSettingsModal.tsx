import { useI18n } from '@renderer/contexts/I18nContext'
import React from 'react'

interface UnsavedSettingsModalProps {
  isOpen: boolean
  onSaveAndLeave: () => Promise<void> | void
  onDiscardAndLeave: () => void
  onCancel: () => void
  isSaving?: boolean
}

export const UnsavedSettingsModal: React.FC<UnsavedSettingsModalProps> = ({
  isOpen,
  onSaveAndLeave,
  onDiscardAndLeave,
  onCancel,
  isSaving = false
}) => {
  const { t } = useI18n()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md p-8 bg-white/95 dark:bg-[#0f0f18]/95 border border-gray-200 dark:border-white/10 rounded-4xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        {/* Warning Icon */}
        <div className="p-4 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl mb-5 shadow-inner">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          {t.views.settings.unsavedModal.title}
        </h3>

        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
          {t.views.settings.unsavedModal.message}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onSaveAndLeave}
            disabled={isSaving}
            className="w-full py-3.5 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving && (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {t.views.settings.unsavedModal.saveAndLeave}
          </button>

          <button
            onClick={onDiscardAndLeave}
            disabled={isSaving}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-800 dark:text-white font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            {t.views.settings.unsavedModal.discardAndLeave}
          </button>

          <button
            onClick={onCancel}
            disabled={isSaving}
            className="w-full py-2.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors cursor-pointer text-sm"
          >
            {t.views.settings.unsavedModal.stay}
          </button>
        </div>
      </div>
    </div>
  )
}

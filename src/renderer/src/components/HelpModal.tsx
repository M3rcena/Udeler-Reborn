import { useI18n } from '@renderer/contexts/I18nContext'
import React from 'react'
import { HelpModalProps } from 'src/preload/types/ipc-types'

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  const { t } = useI18n()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-md transition-opacity">
      <div className="relative bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-4xl p-8 sm:p-10 max-w-xl w-full shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer rounded-full hover:bg-gray-100 dark:hover:bg-white/10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>

        {/* Modal Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-2xl text-blue-600 dark:text-blue-400">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                ></path>
              </svg>
            </div>
            {t.components.helpModal.locateToken}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-3 font-medium">
            {t.components.helpModal.followSteps}
          </p>
        </div>

        {/* Instruction Steps - Cards Layout */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-5 p-5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
            <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-lg shadow-inner">
              1
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-1.5">
              {t('components.helpModal.loginUdemy', {
                udemyBold: (
                  <strong className="text-gray-900 dark:text-white font-bold">Udemy</strong>
                )
              })}
            </p>
          </div>

          <div className="flex items-start gap-5 p-5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
            <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-lg shadow-inner">
              2
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-1.5">
              {t('components.helpModal.pressKey', {
                f12Key: (
                  <kbd className="bg-white dark:bg-black/30 px-2 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-white/10 font-mono text-gray-900 dark:text-white shadow-sm mx-1">
                    F12
                  </kbd>
                )
              })}
            </p>
          </div>

          <div className="flex items-start gap-5 p-5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
            <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-lg shadow-inner">
              3
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-1.5">
              {t('components.helpModal.navigateToApplication', {
                applicationStrong: (
                  <strong className="text-gray-900 dark:text-white">
                    {t.components.helpModal.navigateKeys.application}
                  </strong>
                ),
                storageBold: (
                  <strong className="text-gray-900 dark:text-white">
                    {t.components.helpModal.navigateKeys.storage}
                  </strong>
                )
              })}
            </p>
          </div>

          <div className="flex items-start gap-5 p-5 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-500/20 transition-colors">
            <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-lg shadow-lg shadow-blue-500/30">
              4
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-1.5">
              {t('components.helpModal.cookies.main', {
                cookiesStrong: (
                  <strong className="text-gray-900 dark:text-white">
                    {t.components.helpModal.cookies.cookies}
                  </strong>
                ),
                udemyURL: (
                  <code className="text-blue-600 dark:text-blue-400 break-all">
                    https://www.udemy.com
                  </code>
                ),
                tokenCode: (
                  <code className="bg-white dark:bg-black/30 px-2 py-1 rounded-md text-blue-600 dark:text-blue-400 font-mono text-sm border border-gray-200 dark:border-white/10 shadow-sm mx-1">
                    access_token
                  </code>
                )
              })}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="mt-8 w-full py-4 bg-gray-900 dark:bg-white/10 hover:bg-gray-800 dark:hover:bg-white/20 text-white font-bold rounded-2xl transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl"
        >
          {t.components.helpModal.gotToken}
        </button>
      </div>
    </div>
  )
}

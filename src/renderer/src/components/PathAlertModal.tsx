import { PathAlertModalProps } from 'src/preload/ipc-types'

export const PathAlertModal: React.FC<PathAlertModalProps> = ({ isOpen, onClose }) => {
  // If the modal isn't open, don't render anything
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md p-8 bg-white/95 dark:bg-[#0f0f18]/95 border border-gray-200 dark:border-white/10 rounded-4xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        {/* Warning Icon */}
        <div className="p-4 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 rounded-2xl mb-5 shadow-inner">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            ></path>
          </svg>
        </div>

        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Setup Required</h3>

        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
          You need to select a{' '}
          <span className="font-semibold text-gray-800 dark:text-gray-200">Download Folder</span> in
          in the Settings menu before you can save course content to your computer.
        </p>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  )
}

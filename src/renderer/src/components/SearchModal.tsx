import React, { useEffect, useRef, useState } from 'react'
import { SearchResult } from 'src/preload/types/ipc-types'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectResult: (lectureId: number) => void
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onSelectResult }) => {
  const [query, setQuery] = useState<string>('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      window.api.invoke('rebuild-search-index')
    } else {
      setTimeout(() => {
        setQuery('')
        setResults([])
      })
    }
  }, [isOpen])

  useEffect(() => {
    if (!query.trim()) {
      setTimeout(() => {
        setResults([])
      })
      return
    }

    const timer = setTimeout(async (): Promise<void> => {
      setIsSearching(true)
      try {
        const data = await window.api.invoke('search-index', query)
        setResults(data)
      } catch (err) {
        console.error('Search failed', err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  if (!isOpen) return null

  const titleMatches = results.filter((r) => r.matchType === 'title')
  const transcriptMatches = results.filter((r) => r.matchType === 'transcript')

  const renderResult = (res: SearchResult): React.JSX.Element => (
    <div
      key={res.id}
      onClick={() => {
        onSelectResult(res.lectureId)
        onClose()
      }}
      className="px-6 py-4 border-b border-gray-100 dark:border-white/5 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer transition-colors group"
    >
      <div className="flex justify-between items-start mb-1">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
          {res.lectureTitle}
        </h4>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium line-clamp-1">
        {res.courseTitle} <span className="opacity-50">/</span> {res.chapterTitle}
      </p>
      {res.textSnippet && res.textSnippet !== 'Matched in title' && (
        <div className="bg-white dark:bg-black/40 p-2.5 rounded-lg border border-gray-200 dark:border-white/10">
          <p className="text-xs text-gray-600 dark:text-gray-300 italic line-clamp-2 leading-relaxed">
            &quot;{res.textSnippet}&quot;
          </p>
        </div>
      )}
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-200 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#0f0f18] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Input Area */}
        <div className="flex items-center px-4 py-4 border-b border-gray-200 dark:border-white/10">
          <svg
            className="w-6 h-6 text-gray-400 mr-3 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcripts, courses, and lectures... (Cmd/Ctrl + K)"
            className="flex-1 bg-transparent border-none focus:outline-none text-lg text-gray-900 dark:text-white placeholder-gray-400"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
            }}
          />
          {isSearching && (
            <svg
              className="w-5 h-5 animate-spin text-blue-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              ></path>
            </svg>
          )}
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar flex flex-col bg-gray-50/50 dark:bg-transparent relative">
          {query.trim() && results.length === 0 && !isSearching && (
            <div className="p-8 text-center text-gray-500">
              No results found for &quot;{query}&quot;
            </div>
          )}

          {titleMatches.length > 0 && (
            <>
              <div className="sticky top-0 z-10 px-6 py-2 bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider shadow-sm">
                Title Matches
              </div>
              {titleMatches.map((res) => renderResult(res))}
            </>
          )}

          {transcriptMatches.length > 0 && (
            <>
              <div className="sticky top-0 z-10 px-6 py-2 bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-md border-y border-gray-200 dark:border-white/10 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider shadow-sm">
                Transcript Matches
              </div>
              {transcriptMatches.map((res) => renderResult(res))}
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-200 dark:border-white/10 text-[10px] text-gray-500 font-medium flex justify-between bg-gray-50 dark:bg-white/5">
          <span>Custom Local Engine</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  )
}

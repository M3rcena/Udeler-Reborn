import React from 'react'

interface SimpleMarkdownProps {
  content: string
}

export const SimpleMarkdown: React.FC<SimpleMarkdownProps> = ({ content }) => {
  const parseInline = (text: string): React.ReactNode[] => {
    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\)|\*.*?\*)/g
    const parts = text.split(regex)

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-gray-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={index}
            className="bg-gray-200 dark:bg-white/10 px-1.5 py-0.5 rounded text-[11px] font-mono text-pink-500 dark:text-pink-400"
          >
            {part.slice(1, -1)}
          </code>
        )
      }
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/)
        if (linkMatch) {
          return (
            <a
              key={index}
              href={linkMatch[2]}
              target="_blank"
              rel="noreferrer"
              className="text-blue-500 hover:underline cursor-pointer"
            >
              {linkMatch[1]}
            </a>
          )
        }
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={index} className="italic">
            {part.slice(1, -1)}
          </em>
        )
      }
      return part
    })
  }

  const lines = content.split('\n')

  return (
    <div className="flex flex-col gap-2 text-xs text-gray-700 dark:text-gray-300">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={idx} className="h-1" />

        // Horizontal Rule
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
          return <hr key={idx} className="border-t border-gray-200 dark:border-white/10 my-3" />
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-2">
              {parseInline(trimmed.slice(4))}
            </h4>
          )
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3
              key={idx}
              className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-white/10 pb-1 mt-3"
            >
              {parseInline(trimmed.slice(3))}
            </h3>
          )
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2
              key={idx}
              className="text-base font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-white/10 pb-1 mt-3"
            >
              {parseInline(trimmed.slice(2))}
            </h2>
          )
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-blue-500 select-none">•</span>
              <div className="flex-1 leading-relaxed">{parseInline(trimmed.slice(2))}</div>
            </div>
          )
        }
        return (
          <p key={idx} className="leading-relaxed">
            {parseInline(trimmed)}
          </p>
        )
      })}
    </div>
  )
}

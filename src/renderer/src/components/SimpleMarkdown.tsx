import DOMPurify from 'dompurify'
import React from 'react'

interface SimpleMarkdownProps {
  content: string
}

export const SimpleMarkdown: React.FC<SimpleMarkdownProps> = ({ content }) => {
  const parseInline = (text: string): React.ReactNode[] => {
    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\)|\*.*?\*|<[^>]+>)/g
    const parts = text.split(regex)

    return parts.map((part, index) => {
      if (!part) return null

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

  const hasRawHtml = /<[a-z][\s\S]*>/i.test(content)

  if (hasRawHtml) {
    const rawProcessed = content
      .replace(
        /^### (.*$)/gim,
        '<h4 class="text-sm font-bold text-blue-600 dark:text-blue-400 mt-3 mb-1">$1</h4>'
      )
      .replace(
        /^## (.*$)/gim,
        '<h3 class="text-base font-bold text-gray-900 dark:text-white mt-4 mb-2 pb-1 border-b border-gray-200 dark:border-white/10">$1</h3>'
      )
      .replace(
        /^# (.*$)/gim,
        '<h2 class="text-lg font-extrabold text-gray-900 dark:text-white mt-4 mb-2 pb-1 border-b border-gray-200 dark:border-white/10">$1</h2>'
      )
      .replace(
        /\*\*(.*?)\*\*/gim,
        '<strong class="font-bold text-gray-900 dark:text-white">$1</strong>'
      )
      .replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>')
      .replace(
        /`([^`]+)`/gim,
        '<code class="bg-gray-200 dark:bg-white/10 px-1.5 py-0.5 rounded text-[11px] font-mono text-pink-500 dark:text-pink-400">$1</code>'
      )
      .replace(
        /\[(.*?)\]\((.*?)\)/gim,
        '<a href="$2" target="_blank" rel="noreferrer" class="text-blue-500 hover:underline cursor-pointer">$1</a>'
      )
      .replace(
        /^\s*[-*]\s+(.*$)/gim,
        '<div class="flex items-start gap-2 pl-2 my-1"><span class="text-blue-500 select-none">•</span><span>$1</span></div>'
      )
      .replace(/\n\n/g, '<div class="h-3"></div>')

    const cleanHtml = DOMPurify.sanitize(rawProcessed, {
      ALLOWED_TAGS: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'span',
        'div',
        'strong',
        'em',
        'code',
        'pre',
        'a',
        'img',
        'br',
        'hr',
        'ul',
        'ol',
        'li',
        'center'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'align', 'target', 'rel', 'style']
    })

    return (
      <div
        className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300 leading-relaxed [&_h1]:text-xl [&_h1]:font-extrabold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_p]:leading-relaxed [&_img]:max-w-full [&_img]:rounded-xl"
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
    )
  }

  const lines = content.split('\n')
  return (
    <div className="flex flex-col gap-2 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={idx} className="h-1" />

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

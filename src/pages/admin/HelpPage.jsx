import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import manualText from '../../../docs/客服操作手册.md?raw'
import { BookOpen, Printer } from 'lucide-react'

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 print:px-0 print:py-0">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-2">
          <BookOpen className="text-rose-700" size={22} />
          <h1 className="text-xl font-bold text-gray-800">客服操作手册</h1>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <Printer size={14} /> 打印
        </button>
      </div>

      <article className="manual-content bg-white rounded-xl shadow-sm p-6 sm:p-8 print:shadow-none print:p-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{manualText}</ReactMarkdown>
      </article>

      <style>{`
        .manual-content h1 { display: none; }
        .manual-content h2 {
          font-size: 1.25rem; font-weight: 700; color: #111827;
          margin-top: 2rem; margin-bottom: 1rem;
          padding-bottom: 0.5rem; border-bottom: 2px solid #fda4af;
        }
        .manual-content h2:first-child { margin-top: 0; }
        .manual-content h3 {
          font-size: 1.05rem; font-weight: 600; color: #1f2937;
          margin-top: 1.25rem; margin-bottom: 0.5rem;
        }
        .manual-content p { color: #374151; line-height: 1.7; margin: 0.5rem 0; }
        .manual-content ul, .manual-content ol {
          padding-left: 1.5rem; margin: 0.5rem 0; color: #374151; line-height: 1.7;
        }
        .manual-content ul { list-style: disc; }
        .manual-content ol { list-style: decimal; }
        .manual-content li { margin: 0.25rem 0; }
        .manual-content strong { color: #111827; font-weight: 600; }
        .manual-content code {
          background: #f3f4f6; padding: 0.1rem 0.4rem;
          border-radius: 0.25rem; font-size: 0.9em; color: #be185d;
        }
        .manual-content blockquote {
          border-left: 3px solid #f43f5e; background: #fff1f2;
          padding: 0.75rem 1rem; margin: 0.75rem 0; border-radius: 0 0.5rem 0.5rem 0;
          color: #4b5563;
        }
        .manual-content blockquote p { margin: 0.25rem 0; }
        .manual-content table {
          border-collapse: collapse; width: 100%; margin: 1rem 0;
          font-size: 0.9em;
        }
        .manual-content th, .manual-content td {
          border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: left;
        }
        .manual-content th { background: #f9fafb; font-weight: 600; color: #111827; }
        .manual-content tbody tr:nth-child(odd) { background: #fafafa; }
        .manual-content hr { border: none; border-top: 1px dashed #d1d5db; margin: 2rem 0; }
        .manual-content a { color: #be123c; text-decoration: underline; }
        @media print {
          .manual-content h2 { break-after: avoid; }
          .manual-content table, .manual-content blockquote { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

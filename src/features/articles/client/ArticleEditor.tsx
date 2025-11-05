/**
 * Rich text editor for article drafts using Tiptap.
 *
 * Installation:
 * ```bash
 * bun add @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder
 * ```
 *
 * Usage:
 * ```tsx
 * import { ArticleEditor } from '@features/articles/client/ArticleEditor'
 *
 * <ArticleEditor
 *   initialContent={article.bodyHtml}
 *   onSave={(html) => saveArticle(html)}
 * />
 * ```
 */

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { useEffect, useState } from 'react'

export type ArticleEditorProps = {
  initialContent?: string | null
  onSave?: (html: string) => void | Promise<void>
  placeholder?: string
  className?: string
  onChange?: (html: string) => void
  showSaveButton?: boolean
  readOnly?: boolean
}

export function ArticleEditor({
  initialContent,
  onSave,
  placeholder = 'Write your article here...',
  className = '',
  onChange,
  showSaveButton = true,
  readOnly = false
}: ArticleEditorProps) {
  const [isSaving, setIsSaving] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4]
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank'
        }
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder
      })
    ],
    content: initialContent ?? '',
    editable: !readOnly,
    onUpdate({ editor }) {
      onChange?.(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[400px] p-4'
      }
    }
  })

  useEffect(() => {
    if (!editor) return
    const next = initialContent ?? ''
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  }, [editor, initialContent])

  useEffect(() => {
    if (!editor) return
    onChange?.(editor.getHTML())
  }, [editor, onChange])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readOnly)
  }, [editor, readOnly])

  const handleSave = async () => {
    if (!editor || !onSave) return

    const html = editor.getHTML()
    setIsSaving(true)
    try {
      await onSave(html)
    } finally {
      setIsSaving(false)
    }
  }

  if (!editor) return null

  return (
    <div className={`border rounded-lg ${className}`}>
      {/* Toolbar */}
      <div
        className={`flex flex-wrap gap-1 p-2 border-b bg-gray-50 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}
        aria-disabled={readOnly}
      >
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <em>I</em>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Strikethrough"
        >
          <s>S</s>
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          H2
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          H3
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          • List
        </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        1. List
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Blockquote"
      >
        &ldquo; Quote
      </ToolbarButton>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <ToolbarButton
        onClick={() => {
          const url = window.prompt('Image URL')?.trim()
          if (!url) return
          const alt = window.prompt('Alt text')?.trim() || ''
          editor.commands.setImage({ src: url, alt })
        }}
        title="Insert Image"
      >
        Img
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })}
        title="Insert Table"
      >
        Table
      </ToolbarButton>

      <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          ↶ Undo
        </ToolbarButton>

        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          ↷ Redo
        </ToolbarButton>

        {showSaveButton && onSave && !readOnly ? (
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : null}
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} className="min-h-[400px]" />
    </div>
  )
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  children
}: {
  onClick: () => void
  isActive?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-sm hover:bg-gray-200 ${
        isActive ? 'bg-gray-300 font-semibold' : ''
      }`}
    >
      {children}
    </button>
  )
}

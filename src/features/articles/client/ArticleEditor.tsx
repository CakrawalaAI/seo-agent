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
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { useEffect, useState } from 'react'
import { cn } from '@src/common/ui/cn'

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
        },
        link: {
          openOnClick: false,
          HTMLAttributes: {
            rel: 'noopener noreferrer',
            target: '_blank'
          }
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
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl min-h-[400px] p-4 focus:outline-none text-foreground dark:prose-invert'
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
    <div className={cn('overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-sm', className)}>
      {/* Toolbar */}
      <div
        className={cn(
          'flex flex-wrap gap-1 border-b border-border bg-card p-2 text-foreground shadow-sm transition-colors dark:bg-muted',
          readOnly && 'pointer-events-none opacity-60'
        )}
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

        <div className="mx-1 h-6 w-px bg-border/70 dark:bg-border/40" />

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

        <div className="mx-1 h-6 w-px bg-border/70 dark:bg-border/40" />

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

      <div className="mx-1 h-6 w-px bg-border/70 dark:bg-border/40" />

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

      <div className="mx-1 h-6 w-px bg-border/70 dark:bg-border/40" />

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
              className="rounded bg-primary px-4 py-1 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : null}
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} className="tiptap min-h-[400px] rounded-b-lg bg-card text-foreground" />
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
      className={cn(
        'rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:hover:bg-muted/40',
        isActive && 'bg-muted text-foreground font-semibold shadow-inner'
      )}
    >
      {children}
    </button>
  )
}

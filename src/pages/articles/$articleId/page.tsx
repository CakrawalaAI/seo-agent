import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ExternalLink, Link as LinkIcon, Youtube } from 'lucide-react'
import { useMockData } from '@common/dev/mock-data-context'
import { useActiveWebsite } from '@common/state/active-website'
import { Badge } from '@src/common/ui/badge'
import { Button } from '@src/common/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@src/common/ui/card'
import { Separator } from '@src/common/ui/separator'
import { Skeleton } from '@src/common/ui/skeleton'
import { formatDateTime } from '@src/common/ui/format'
import { getArticle, type ArticleDetail } from '@entities/article/service'
import type { ArticleGenerationPayload, ArticleAttachment } from '@entities'
import { ArticleMediaManager } from '@features/articles/client/ArticleMediaManager'

type PageProps = {
  articleId: string
  mode?: string | null
}

const FEATURE_LABELS: Record<string, string> = {
  serp: 'SERP Benchmark',
  youtube: 'YouTube Enrichment',
  imageUnsplash: 'Unsplash Images',
  imageAi: 'AI Images',
  research: 'External Research',
  attachments: 'Attachment Sync'
}

export function Page({ articleId, mode }: PageProps): JSX.Element {
  const navigate = useNavigate()
  const { enabled: mockEnabled } = useMockData()
  const { id: projectId } = useActiveWebsite()

  const detailQuery = useQuery({
    queryKey: ['articles.detail', articleId],
    queryFn: () => getArticle(articleId),
    enabled: Boolean(articleId) && !mockEnabled
  })

  const detail: ArticleDetail | undefined = useMemo(() => {
    if (mockEnabled) return buildMockDetail(articleId, projectId)
    return detailQuery.data
  }, [articleId, detailQuery.data, mockEnabled, projectId])

  const isLoading = detailQuery.isLoading && !detail

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
        <h2 className="text-xl font-semibold">Article not found</h2>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t locate that article. It may have been deleted or you might not have access.
        </p>
        <Button variant="secondary" onClick={() => navigate({ to: '/articles' })}>
          Back to Articles
        </Button>
      </div>
    )
  }

  const { article, attachments } = detail
  const payload = (article.payloadJson as ArticleGenerationPayload | null) ?? null
  const outline = (article.outlineJson ?? payload?.outline ?? []) || []
  const features = payload?.context?.features ?? {}
  const citations = payload?.context?.citations ?? []
  const youtube = payload?.context?.youtube ?? []
  const internalLinks = payload?.context?.internalLinks ?? []
  const imagesFromPayload = payload?.context?.images ?? []
  const serpDump = payload?.context?.serpDump ?? ''
  const websiteSummary = payload?.context?.websiteSummary ?? ''

  const wordCount = payload?.wordCount ?? estimateWords(article.bodyHtml)
  const readingMinutes = payload?.readingMinutes ?? Math.max(1, Math.round(wordCount / 200) || 1)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-12">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate({ to: '/articles' })}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="uppercase">
            {article.status ?? 'unknown'}
          </Badge>
          {article.targetKeyword ? (
            <Badge variant="outline" className="text-xs font-medium">
              Keyword: {article.targetKeyword}
            </Badge>
          ) : null}
          {article.language ? (
            <Badge variant="outline" className="text-xs font-medium">
              Locale: {article.language}
            </Badge>
          ) : null}
          {article.tone ? (
            <Badge variant="outline" className="text-xs font-medium">
              Tone: {article.tone}
            </Badge>
          ) : null}
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({
                to: '/articles/$articleId',
                params: { articleId },
                search: mode === 'edit' ? undefined : { mode: 'edit' }
              })
            }
          >
            {mode === 'edit' ? 'Close Editor' : 'Open Editor'}
          </Button>
          {article.url ? (
            <Button asChild size="sm">
              <a href={article.url} target="_blank" rel="noreferrer">
                View Live
                <ExternalLink className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{article.title ?? 'Untitled Article'}</CardTitle>
          <CardDescription>
            Generated on {formatDateTime(article.generationDate ?? payload?.generatedAt ?? article.updatedAt ?? '')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <MetaItem label="Scheduled Date" value={formatDateTime(article.scheduledDate ?? null)} />
          <MetaItem label="Publish Date" value={formatDateTime(article.publishDate ?? null)} />
          <MetaItem label="Word Count" value={wordCount ? `${wordCount.toLocaleString()} words` : '—'} />
          <MetaItem label="Reading Time" value={`${readingMinutes} min`} />
          <MetaItem label="Project" value={projectId || '—'} />
          <MetaItem label="Outline Sections" value={outline.length ? String(outline.length) : '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Website Summary &amp; Features</CardTitle>
          <CardDescription>Context used to guide the generation run</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">Business Summary</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
              {websiteSummary || 'No summary captured for this website.'}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">Enrichment Flags</h3>
            <div className="mt-2 grid gap-2">
              {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                const enabled = Boolean(features[key as keyof typeof features])
                return (
                  <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{label}</span>
                    <Badge variant={enabled ? 'default' : 'outline'} className="text-xs">
                      {enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outline</CardTitle>
          <CardDescription>Structure delivered to the LLM</CardDescription>
        </CardHeader>
        <CardContent>
          {outline.length ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {outline.map((section, idx) => (
                <li key={`${section.heading}-${idx}`} className="font-medium">
                  {section.heading}
                  {Array.isArray(section.subpoints) && section.subpoints.length ? (
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                      {section.subpoints.map((point, subIdx) => (
                        <li key={`${section.heading}-sub-${subIdx}`}>{point}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No outline stored for this draft.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Article Body</CardTitle>
          <CardDescription>Rendered HTML captured at generation time</CardDescription>
        </CardHeader>
        <CardContent>
          {article.bodyHtml ? (
            <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: article.bodyHtml }} />
          ) : (
            <p className="text-sm text-muted-foreground">Draft body is empty.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>References</CardTitle>
            <CardDescription>Sources returned by the research provider</CardDescription>
          </CardHeader>
          <CardContent>
            {citations.length ? (
              <ol className="space-y-3 text-sm">
                {citations.map((citation, idx) => (
                  <li key={`${citation.url}-${idx}`} className="space-y-1">
                    <div className="font-medium">
                      [{idx + 1}] {citation.title || citation.url}
                    </div>
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <LinkIcon className="h-3 w-3" />
                      {citation.url}
                    </a>
                    {citation.snippet ? (
                      <p className="text-xs text-muted-foreground">{citation.snippet}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No citations collected.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Internal Links &amp; YouTube</CardTitle>
            <CardDescription>Crosslinks suggested during generation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <SectionList
              label="Internal Links"
              items={internalLinks.map((link) => ({
                label: link.anchor || link.url,
                url: link.url
              }))}
              empty="No internal links suggested."
            />
            <Separator />
            <SectionList
              label="YouTube"
              icon={<Youtube className="h-3.5 w-3.5 text-primary" />}
              items={youtube.map((video) => ({
                label: video.title || video.url,
                url: video.url
              }))}
              empty="No YouTube videos attached."
            />
          </CardContent>
        </Card>
      </div>

      <ArticleMediaManager
        articleId={articleId}
        attachments={attachments}
        disabled={mockEnabled}
        onRefresh={() => {
          void detailQuery.refetch()
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>SERP Snapshot</CardTitle>
          <CardDescription>Top competitor excerpts captured during generation</CardDescription>
        </CardHeader>
        <CardContent>
          {serpDump ? (
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
              {serpDump.trim()}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">SERP snapshot not available.</p>
          )}
          {imagesFromPayload.length ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {imagesFromPayload.map((img, idx) => (
                <figure key={`${img.src}-${idx}`} className="w-32 space-y-1">
                  <img src={img.src} alt={img.alt || ''} className="h-20 w-full rounded object-cover" />
                  <figcaption className="text-xs text-muted-foreground">{img.caption || img.alt || img.src}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground/90">{value || '—'}</div>
    </div>
  )
}

function SectionList({
  label,
  items,
  empty,
  icon
}: {
  label: string
  items: Array<{ label: string; url: string }>
  empty: string
  icon?: React.ReactNode
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        {icon}
        {label}
      </h3>
      {items.length ? (
        <ul className="space-y-2 text-sm">
          {items.map((item, idx) => (
            <li key={`${item.url}-${idx}`}>
              <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                <ExternalLink className="h-3 w-3" />
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}

function estimateWords(html?: string | null): number {
  if (!html) return 0
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return 0
  return text.split(' ').length
}

function buildMockDetail(articleId: string, projectId?: string | null): ArticleDetail {
  const now = new Date()
  const article = {
    id: articleId,
    websiteId: projectId || 'proj_mock',
    title: 'Mock Article — How to Structure STAR Responses',
    targetKeyword: 'STAR method interview example',
    language: 'en-US',
    tone: 'authoritative',
    status: 'scheduled',
    outlineJson: [
      { heading: 'Introduction' },
      { heading: 'Step-by-Step STAR Breakdown' },
      { heading: 'Sample Answers' },
      { heading: 'Common Mistakes' },
      { heading: 'Conclusion' }
    ],
    bodyHtml:
      '<article><h1>Mock Article</h1><p>This is mock content for offline preview. Replace with real data.</p></article>',
    generationDate: now.toISOString(),
    scheduledDate: now.toISOString(),
    publishDate: null,
    payloadJson: {
      version: 1,
      articleId,
      websiteId: projectId ?? 'proj_mock',
      title: 'Mock Article — How to Structure STAR Responses',
      targetKeyword: 'STAR method interview example',
      locale: 'en-US',
      outline: [
        { heading: 'Introduction' },
        { heading: 'Step-by-Step STAR Breakdown' },
        { heading: 'Sample Answers' },
        { heading: 'Common Mistakes' },
        { heading: 'Conclusion' }
      ],
      bodyHtml:
        '<article><h1>Mock Article</h1><p>This is mock content for offline preview. Replace with real data.</p></article>',
      wordCount: 820,
      readingMinutes: 4,
      generatedAt: now.toISOString(),
      context: {
        websiteSummary: 'PrepInterview helps candidates master behavioral interviews with structured practice.',
        serpDump: '1. BigInterview — How to use STAR Method...\n2. Indeed — STAR Interview Tips...',
        competitorDump: '',
        citations: [
          { title: 'Indeed Career Guide', url: 'https://example.com/indeed', snippet: 'STAR method overview' },
          { title: 'HBR Interview Guide', url: 'https://example.com/hbr' }
        ],
        youtube: [{ title: 'STAR Method Explained', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }],
        images: [
          {
            src: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=640',
            alt: 'People collaborating at a table',
            caption: 'Photo by You X Ventures on Unsplash'
          }
        ],
        internalLinks: [
          { anchor: 'Interview Question Bank', url: 'https://prepinterview.ai/interview-questions' },
          { anchor: 'Behavioral Interview Tips', url: 'https://prepinterview.ai/behavioral' }
        ],
        features: {
          serp: true,
          youtube: true,
          imageUnsplash: true,
          imageAi: false,
          research: true,
          attachments: true
        }
      }
    }
  } as any

  const attachments: ArticleAttachment[] = [
    {
      id: 'att_mock_1',
      articleId,
      type: 'image',
      url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=640',
      caption: 'Photo by You X Ventures on Unsplash'
    },
    {
      id: 'att_mock_2',
      articleId,
      type: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      caption: 'STAR Method Explained'
    }
  ]

  return { article, attachments }
}

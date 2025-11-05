type GenerateImagesInput = {
  prompt: string
  count?: number
}

type GeneratedImage = { src: string; alt?: string; caption?: string }

export async function generateImages({ prompt, count = 1 }: GenerateImagesInput): Promise<GeneratedImage[]> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY missing')
  const n = Math.max(1, Math.min(4, Math.floor(count)))
  const { OpenAI } = await import('openai')
  const client = new OpenAI({ apiKey: key })
  try {
    const response = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      n
    })
    const results = (response.data || []).map((item, index) => {
      const src = String((item as any).url || '')
      const revised = typeof (item as any).revised_prompt === 'string' ? (item as any).revised_prompt : undefined
      const caption = revised && revised.trim().length ? revised : prompt
      const alt = `${prompt} illustration ${index + 1}`.trim()
      return { src, alt, caption }
    })
    return results.filter((img) => img.src)
  } catch (error) {
    throw new Error((error as Error)?.message || 'openai_image_generation_failed')
  }
}

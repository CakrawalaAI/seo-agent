import { useMutation } from '@tanstack/react-query'
import { Button } from '@src/common/ui/button'
import { Input } from '@src/common/ui/input'
import type { Project } from '@entities'
import { patchProject } from '@entities/project/service'
import { useState } from 'react'

export function SettingsTab({ project }: { project: Project }) {
  const [device, setDevice] = useState(project.serpDevice ?? 'desktop')
  const [serpLoc, setSerpLoc] = useState(String(project.serpLocationCode ?? 2840))
  const [metricsLoc, setMetricsLoc] = useState(String(project.metricsLocationCode ?? 2840))
  const [policy, setPolicy] = useState(project.autoPublishPolicy ?? 'buffered')
  const [buffer, setBuffer] = useState(String(project.bufferDays ?? 3))

  const saveMutation = useMutation({
    mutationFn: () => patchProject(project.id, {
      serpDevice: device,
      serpLocationCode: Number(serpLoc),
      metricsLocationCode: Number(metricsLoc),
      autoPublishPolicy: policy,
      bufferDays: Number(buffer)
    })
  })

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Project settings</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">SERP device</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" variant={device === 'desktop' ? 'default' : 'outline'} onClick={() => setDevice('desktop')}>Desktop</Button>
            <Button type="button" variant={device === 'mobile' ? 'default' : 'outline'} onClick={() => setDevice('mobile')}>Mobile</Button>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">SERP location code</p>
          <Input value={serpLoc} onChange={(e) => setSerpLoc(e.target.value)} className="mt-2" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Metrics location code</p>
          <Input value={metricsLoc} onChange={(e) => setMetricsLoc(e.target.value)} className="mt-2" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Auto publish policy</p>
          <div className="mt-2 flex gap-2">
            {['immediate', 'buffered', 'manual'].map((p) => (
              <Button key={p} type="button" variant={policy === p ? 'default' : 'outline'} onClick={() => setPolicy(p)}>{p}</Button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Buffer days</p>
          <Input value={buffer} onChange={(e) => setBuffer(e.target.value)} className="mt-2" />
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </section>
  )
}


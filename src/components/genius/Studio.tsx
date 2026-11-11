import type { ReactNode } from 'react'
import type { HealthInfo } from '#/genius/server/handlers'
import { Icon } from '#/components/ui/Icon'
import { cn } from '#/utils/id'

/**
 * Layout pieces of the Genius AI Studio: a dark playground with a navigation rail, a canvas with a prompt bar, and a
 * "Run settings" panel. Presentation only: all behaviour lives in GeniusPage, and the settings panel only reports what
 * the server says (models, structured output, local quota, whether DeepSeek is enabled).
 */
export function StudioFrame({ rail, settings, children, prompt }: { rail: ReactNode; settings: ReactNode; children: ReactNode; prompt: ReactNode }) {
  return (
    <div className="studio -m-4 flex min-h-[calc(100vh-3.5rem)] overflow-hidden rounded-none border-y border-line sm:-m-6 sm:rounded-2xl sm:border">
      <aside className="hidden w-[210px] shrink-0 flex-col border-r border-line bg-side p-3 md:flex" aria-label="Studio navigation">{rail}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
        <div className="border-t border-line bg-app p-3 sm:px-6">{prompt}</div>
      </div>
      <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-line bg-side p-3 xl:block" aria-label="Run settings">{settings}</aside>
    </div>
  )
}

export function RailGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

export function RailItem({ icon, label, active, onClick, count }: { icon: string; label: string; active?: boolean; onClick?: () => void; count?: number }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className={cn('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition', active ? 'bg-subtle font-medium text-fg' : 'text-muted hover:bg-subtle/60 hover:text-fg')}>
      <Icon name={icon} size={15} />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && <span className="rounded-full bg-primary/20 px-1.5 text-[10px] font-semibold text-primary">{count}</span>}
    </button>
  )
}

const Switch = ({ on, label, note }: { on: boolean; label: string; note?: string }) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <div className="min-w-0"><div className="text-[13px]">{label}</div>{note && <div className="text-[11px] text-muted">{note}</div>}</div>
    <span role="img" aria-label={on ? 'on' : 'off'} className={cn('mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition', on ? 'justify-end bg-primary' : 'justify-start bg-subtle')}><i className={cn('block size-4 rounded-full', on ? 'bg-app' : 'bg-muted')} /></span>
  </div>
)

const Panel = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="mb-3 rounded-xl border border-line bg-surface p-3">{title && <h3 className="mb-1.5 text-[13px] font-semibold">{title}</h3>}{children}</section>
)

export function RunSettings({ health, sample = false }: { health: HealthInfo | 'unreachable' | null; sample?: boolean }) {
  const h = health && health !== 'unreachable' ? health : null
  return (
    <div className="text-[13px]">
      <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold">Run settings</span><span className="text-[11px] text-muted">{sample ? 'sample values' : health === 'unreachable' ? 'server unreachable' : h ? 'live from the server' : 'checking…'}</span></div>
      <Panel>
        <div className="font-semibold">{h?.models.strong ?? '…'}</div>
        <div className="mt-0.5 text-[11px] text-muted">Designs new CRMs, makes complex changes and repairs. Used only when a request needs it.</div>
        <div className="mt-2 border-t border-line pt-2 font-semibold">{h?.models.fast ?? '…'}</div>
        <div className="mt-0.5 text-[11px] text-muted">Questions, small changes and targeted schema repairs.</div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted"><Icon name={h?.geminiConfigured ? 'CircleCheck' : 'AlertTriangle'} size={12} className={h?.geminiConfigured ? 'text-success' : 'text-warning'} />{h ? (h.geminiConfigured ? 'GEMINI_API_KEY is set on the server' : 'GEMINI_API_KEY is not set') : 'Provider: Gemini'}</div>
      </Panel>
      <Panel title="System instructions">
        <p className="text-[11px] leading-relaxed text-muted">Versioned prompt sections (identity, data model, relationships, workflows, dashboards, record questions, clarification policy, output contract, repair). Built from the same schema the validator uses.</p>
      </Panel>
      <Panel title="Thinking level">
        <div className="flex justify-between text-[12px]"><span className="text-muted">Fast model</span><span className="rounded-md bg-subtle px-1.5 py-0.5 capitalize">{h?.thinking.fast ?? '…'}</span></div>
        <div className="mt-1 flex justify-between text-[12px]"><span className="text-muted">Strong model</span><span className="rounded-md bg-subtle px-1.5 py-0.5 capitalize">{h?.thinking.strong ?? '…'}</span></div>
      </Panel>
      <Panel title="Tools">
        <Switch on={!!h && (h.strictJsonSchema.fast || h.strictJsonSchema.strong)} label="Structured outputs" note="JSON Schema from one canonical contract" />
        <Switch on label="Automatic schema repair" note="Targeted: only invalid parts are re-sent" />
        <Switch on label="Validation before preview" note="6 stages, then you press Apply" />
        <Switch on={!!h?.deepseek.enabled} label="DeepSeek" note={h?.deepseek.reason ?? 'disabled by default'} />
        <Switch on={false} label="Function calling" note="not used: the app executes, the AI plans" />
      </Panel>
      <Panel title="Free-tier budget (this server)">
        {h?.quota.length ? (
          <ul className="space-y-2">
            {h.quota.map((q) => (
              <li key={q.model} className="text-[11px]">
                <div className="font-medium text-fg">{q.model}</div>
                <Bar label={`RPM ${q.requestsLastMinute}/${q.limits.rpm}`} v={q.requestsLastMinute / q.limits.rpm} />
                <Bar label={`RPD ${q.requestsToday}/${q.limits.rpd}`} v={q.requestsToday / q.limits.rpd} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-muted">No request sent yet. Limits (RPM, TPM, RPD) are configurable with GEMINI_RPM_LIMIT, GEMINI_TPM_LIMIT and GEMINI_RPD_LIMIT; Google counts per project, so this is a safety margin.</p>
        )}
      </Panel>
    </div>
  )
}

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div className="mt-1"><div className="flex justify-between text-muted"><span>{label}</span></div><div className="mt-0.5 h-1 overflow-hidden rounded-full bg-subtle"><i className={cn('block h-full rounded-full', v > 0.8 ? 'bg-danger' : 'bg-primary')} style={{ width: `${Math.min(100, Math.round(v * 100))}%` }} /></div></div>
  )
}

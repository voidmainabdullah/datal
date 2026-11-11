import { useMemo, useState } from 'react'
import type { Blueprint } from '#/genius/blueprint/schema'
import { Icon } from '#/components/ui/Icon'
import { cn } from '#/utils/id'

/**
 * A look at the CRM Genius designed, before anything is saved: the left navigation grouped as the user will see it, a
 * Dashboard page with the widgets and what each measures, and one page per module with its real columns, relationships
 * and pipeline stages. It is drawn from the validated blueprint only. There are no invented numbers: the workspace is
 * empty until the change is applied, so tables show their columns and an empty state.
 */
const WIDGET_ICON: Record<string, string> = { stat: 'Hash', metric: 'Hash', bar: 'BarChart3', line: 'LineChart', pie: 'PieChart', table: 'Table', recentRecords: 'ListChecks', progress: 'Gauge', pipeline: 'KanbanSquare' }

export function CrmPreview({ blueprint: bp }: { blueprint: Blueprint }) {
  const [page, setPage] = useState<string>(bp.dashboards.length ? '__dashboard' : (bp.modules[0]?.id ?? '__dashboard'))
  const groups = useMemo(() => {
    const g = new Map<string, typeof bp.modules>()
    for (const m of bp.modules) {
      if (m.navigation?.show === false) continue
      const key = m.navigation?.group ?? 'Modules'
      g.set(key, [...(g.get(key) ?? []), m])
    }
    return [...g.entries()]
  }, [bp])
  const mod = bp.modules.find((m) => m.id === page)
  const nameOf = (id: string) => bp.modules.find((m) => m.id === id)?.plural ?? id
  const rels = mod ? bp.relationships.filter((r) => r.sourceModuleId === mod.id || r.targetModuleId === mod.id) : []
  const pipes = mod ? bp.pipelines.filter((p) => p.moduleId === mod.id) : []

  return (
    <section aria-label="CRM preview" className="overflow-hidden rounded-2xl border border-line bg-app">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5 text-xs text-muted">
        <span className="flex gap-1" aria-hidden><i className="size-2.5 rounded-full bg-[#ff5f57]" /><i className="size-2.5 rounded-full bg-[#febc2e]" /><i className="size-2.5 rounded-full bg-[#28c840]" /></span>
        <span className="mx-auto flex items-center gap-1.5 rounded-md bg-subtle px-3 py-1 text-[11px]"><Icon name="Lock" size={10} />{bp.meta.name} · preview, nothing saved yet</span>
      </div>
      <div className="grid min-h-[340px] grid-cols-[170px_minmax(0,1fr)] max-sm:grid-cols-1">
        <nav aria-label="Preview navigation" className="space-y-3 border-r border-line bg-side p-3 max-sm:border-b max-sm:border-r-0">
          <button type="button" onClick={() => setPage('__dashboard')} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px]', page === '__dashboard' ? 'bg-primary/15 font-semibold text-primary' : 'hover:bg-subtle')}>
            <Icon name="LayoutDashboard" size={14} />Dashboard
          </button>
          {groups.map(([group, mods]) => (
            <div key={group}>
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{group}</div>
              {mods.map((m) => (
                <button key={m.id} type="button" onClick={() => setPage(m.id)} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px]', page === m.id ? 'bg-primary/15 font-semibold text-primary' : 'hover:bg-subtle')}>
                  <span className="flex size-5 items-center justify-center rounded-md" style={{ background: `${m.color ?? '#7B68EE'}26`, color: m.color ?? '#7B68EE' }}><Icon name={m.icon} size={12} /></span>
                  <span className="truncate">{m.plural}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="min-w-0 p-4">
          {page === '__dashboard' || !mod ? (
            <div>
              <h3 className="mb-3 text-sm font-semibold">{bp.dashboards[0]?.name ?? 'Overview'}</h3>
              {bp.dashboards.length === 0 && <p className="text-[13px] text-muted">This design has no dashboard yet. Ask for one after applying.</p>}
              {bp.dashboards.map((d) => (
                <div key={d.id} className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                  {d.components.map((c) => (
                    <div key={c.id} className={cn('rounded-xl border border-line bg-surface p-3', c.w >= 2 && 'col-span-2')}>
                      <div className="flex items-center gap-1.5 text-xs text-muted"><Icon name={WIDGET_ICON[c.type] ?? 'BarChart3'} size={12} />{c.title}</div>
                      <div className="mt-2 text-2xl font-semibold tabular-nums text-muted/70">0</div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted">{c.definition}</p>
                    </div>
                  ))}
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {bp.modules.slice(0, 6).map((m) => (
                  <button type="button" key={m.id} onClick={() => setPage(m.id)} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2.5 text-left text-[13px] transition hover:border-primary/50">
                    <span className="flex size-7 items-center justify-center rounded-lg" style={{ background: `${m.color ?? '#7B68EE'}26`, color: m.color ?? '#7B68EE' }}><Icon name={m.icon} size={14} /></span>
                    <span><span className="block font-medium">{m.plural}</span><span className="text-[11px] text-muted">{m.fields.length} fields</span></span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg" style={{ background: `${mod.color ?? '#7B68EE'}26`, color: mod.color ?? '#7B68EE' }}><Icon name={mod.icon} size={14} /></span>
                <h3 className="text-sm font-semibold">{mod.plural}</h3>
                <span className="rounded-md bg-subtle px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">{mod.kind}</span>
                <span className="ml-auto rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white">+ New {mod.singular.toLowerCase()}</span>
              </div>
              {pipes.map((p) => (
                <div key={p.id} className="mb-3 flex flex-wrap items-center gap-1.5" aria-label={`${mod.singular} pipeline`}>
                  {p.stages.map((s, i) => (
                    <span key={s.id} className="flex items-center gap-1.5 text-[11px]"><span className="rounded-full px-2 py-0.5 font-medium" style={{ background: `${s.color ?? '#7B68EE'}26`, color: s.color ?? '#7B68EE' }}>{s.label}</span>{i < p.stages.length - 1 && <Icon name="Plus" size={0} />}</span>
                  ))}
                </div>
              ))}
              <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                <table className="w-full text-left text-[12px]">
                  <thead><tr className="border-b border-line text-muted">{mod.fields.slice(0, 7).map((f) => <th key={f.id} className="whitespace-nowrap px-3 py-2 font-medium">{f.label}<span className="ml-1 text-[10px] opacity-60">{f.type}</span></th>)}</tr></thead>
                  <tbody>
                    {[0, 1, 2].map((r) => <tr key={r} className="border-b border-line/60 last:border-0">{mod.fields.slice(0, 7).map((f) => <td key={f.id} className="px-3 py-2"><i className="block h-2 rounded bg-subtle" style={{ width: `${45 + ((r * 17 + f.id.length * 7) % 45)}%` }} /></td>)}</tr>)}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-[11px] text-muted">No records yet. These rows are placeholders; your records are never created by a design.</p>
              </div>
              {rels.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">How it connects</div>
                  <ul className="space-y-1 text-[12px]">
                    {rels.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-subtle px-1.5 py-0.5 font-medium">{nameOf(r.sourceModuleId)}</span><Icon name="ArrowLeftRight" size={11} className="text-muted" /><span className="rounded-md bg-subtle px-1.5 py-0.5 font-medium">{nameOf(r.targetModuleId)}</span><span className="text-muted">{r.cardinality}{r.required ? ', required' : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

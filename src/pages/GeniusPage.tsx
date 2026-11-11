import { useEffect, useMemo, useRef, useState } from 'react'
import { usePerms, useWorkflows, useWsId } from '#/hooks/useData'
import { readConfig } from '#/genius/config/storePort'
import { applyProposal, rejectProposal } from '#/genius/service/actions'
import { buildStatus } from '#/genius/service/builder'
import { runGenius, type RunOutput, type StepEvent } from '#/genius/service/run'
import { fetchHealth, httpTransport } from '#/genius/service/transport'
import { useGeniusStore } from '#/genius/state/geniusStore'
import type { QuestionAnswer } from '#/genius/state/types'
import { useGo } from '#/components/layout/AppLink'
import { usePageTitle } from '#/hooks/useData'
import { Button } from '#/components/ui/Button'
import { Icon } from '#/components/ui/Icon'
import { Badge, Card, Notice } from '#/components/ui/misc'
import { CrmPreview } from '#/components/genius/CrmPreview'
import { RailGroup, RailItem, RunSettings, StudioFrame } from '#/components/genius/Studio'
import { SAMPLE_BLUEPRINT } from '#/genius/sampleBlueprint'
import type { HealthInfo } from '#/genius/server/handlers'
import { AutomationsPanel, HistoryPanel } from '#/components/genius/GeniusHistory'
import { ClarifyForm, ProposalView, RepairPanel, StatusBadge, StepList, type ShownStep } from '#/components/genius/GeniusParts'
import { confirmDialog, toast } from '#/utils/toast'

type Tab = 'build' | 'history' | 'automations'

const EXAMPLES: { mode: string; icon: string; text: string }[] = [
  { mode: 'New build', icon: 'Sparkles', text: 'Create a CRM for my school academy: students, guardians, classes, attendance and fees' },
  { mode: 'New build', icon: 'Sparkles', text: 'Create a CRM for a letting agency with landlords, properties, enquiries, tenancies and rent payments' },
  { mode: 'Extend', icon: 'Plus', text: 'Add a notes field to Students' },
  { mode: 'Change a rule', icon: 'Scale', text: 'Make the admission number required and unique for Students' },
  { mode: 'Ask', icon: 'MessageSquare', text: 'How is Outstanding calculated?' },
  { mode: 'Ask', icon: 'MessageSquare', text: 'Simulate the fee reminder workflow without sending anything' },
  { mode: 'Undo', icon: 'RotateCcw', text: 'Undo the last change' },
]

const LIMITS = [
  'Genius designs and changes your CRM configuration: modules, fields, relationships, calculations, forms, views, pipelines, workflows, dashboards and roles. It never edits or deletes your records.',
  'Nothing is applied until you press “Apply change”. Every applied change becomes a version you can undo. Modules that hold records are archived, never deleted.',
  'Automations run only while this app is open in a browser tab. There is no background server, and no email, SMS or WhatsApp channel, so Genius cannot build anything that messages people. Such parts are listed as “not implementable”.',
  'Role limits here protect the screens of this browser session. They are not server-side security.',
  'Money is calculated exactly (no floating point), in a single currency per calculation. There is no exchange-rate conversion.',
  'AI output can be wrong. It is checked by six automatic stages, but read the summary and the dry run before you approve anything.',
  'Genius needs the server secret GEMINI_API_KEY. Without it, only exact changes made by code (rename, switch a workflow off, explain a calculation, undo) work.',
]

export function GeniusPage() {
  const ws = useWsId()
  const go = useGo()
  const perms = usePerms()
  const workflows = useWorkflows()
  const proposals = useGeniusStore((s) => s.proposals)
  const versions = useGeniusStore((s) => s.versions)
  const pendingQs = useGeniusStore((s) => s.memory[ws]?.pendingQuestions)
  const [tab, setTab] = useState<Tab>('build')
  const [request, setRequest] = useState('')
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [steps, setSteps] = useState<StepEvent[]>([])
  const [saveStep, setSaveStep] = useState<ShownStep | null>(null)
  const [out, setOut] = useState<RunOutput | null>(null)
  const [health, setHealth] = useState<HealthInfo | 'unreachable' | null>(null)
  const ac = useRef<AbortController | null>(null)
  const canBuild = perms.can('manageFields')

  useEffect(() => {
    let live = true
    fetchHealth().then((h) => live && setHealth(h)).catch(() => live && setHealth('unreachable'))
    return () => { live = false }
  }, [])

  const status = useMemo(() => buildStatus(ws), [ws, proposals, versions, workflows])
  const pending = proposals.filter((p) => p.workspaceId === ws && (p.state === 'draft' || p.state === 'validated')).at(-1)
  const shown = out?.kind === 'proposal' ? (proposals.find((p) => p.id === out.proposal.id) ?? out.proposal) : pending && !out ? pending : null
  const externalAutomation = !!shown && shown.state !== 'accepted' && shown.notImplementable.length > 0

  const run = async (text: string, answers?: QuestionAnswer[]) => {
    if (!text.trim() || running) return
    const ctl = new AbortController()
    ac.current = ctl
    setRunning(true)
    setOut(null)
    setSteps([])
    setSaveStep(null)
    try {
      const res = await runGenius({ workspaceId: ws, request: text, answers, signal: ctl.signal, onStep: (e) => setSteps((prev) => (prev.some((s) => s.id === e.id) ? prev.map((s) => (s.id === e.id ? e : s)) : [...prev, e])) }, { transport: httpTransport })
      if (!ctl.signal.aborted) setOut(res)
    } catch (e) {
      setOut({ kind: 'error', code: 'unexpected', message: `Something went wrong. Your CRM is unchanged.${e instanceof Error ? ` (${e.message})` : ''}`, retryable: true, intent: 'new_build', correlationId: '', steps: [], usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, calls: 0, latencyMs: 0, source: 'gemini' } })
    } finally {
      setRunning(false)
    }
  }
  const cancel = () => {
    ac.current?.abort()
    setRunning(false)
    toast.info('Cancelled', 'Nothing was changed.')
  }

  const accept = async () => {
    if (!shown) return
    const destructive = shown.changes.filter((c) => c.destructive)
    if (destructive.length && !(await confirmDialog({ title: 'This change removes parts of your CRM', message: `${destructive.map((c) => c.label).slice(0, 5).join('; ')}. Your records are kept, but these definitions go away (you can undo it from the history).`, confirmLabel: 'Apply change', danger: true }))) return
    setSaving(true)
    const t0 = performance.now()
    setSaveStep({ id: 'save', label: 'Saving to your CRM', status: 'running' })
    const r = applyProposal(shown.id, { confirmDestructive: destructive.length > 0 })
    setSaving(false)
    setSaveStep({ id: 'save', label: 'Saving to your CRM', status: r.ok ? 'done' : 'error', detail: r.ok ? `saved as version ${r.version.number}` : r.error, ms: Math.round(performance.now() - t0) })
    if (r.ok) {
      const newWs = (r as { workspaceId?: string }).workspaceId
      if (newWs && newWs !== ws) {
        toast.success('New project created', `It lives in its own empty workspace, with its own Overview. Saved as version ${r.version.number}.`)
        go('/')
      } else toast.success(r.duplicate ? 'Already applied' : 'Change applied', `Saved as version ${r.version.number}. You can undo it from History.`)
    }
    else toast.error('Nothing was changed', r.error)
  }
  const reject = () => {
    if (shown && rejectProposal(shown.id)) {
      setOut(null)
      toast.info('Proposal rejected', 'Your CRM is unchanged.')
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void run(request)
    }
  }

  const clarifyQs = out?.kind === 'clarify' ? out.questions : !out && !running && pendingQs?.length ? pendingQs : null

  usePageTitle('Genius AI Studio · Xcrm')
  const strongModel = health && health !== 'unreachable' ? health.models.strong : 'Gemini'
  const blueprintShown = shown?.blueprint ?? undefined
  const diagnostics = out?.kind === 'proposal' ? out.diagnostics : undefined

  const rail = (
    <>
      <div className="mb-4 flex items-center gap-2 px-2 pt-1"><Icon name="Sparkles" size={18} className="text-primary" /><span className="text-[15px] font-semibold">Genius AI Studio</span></div>
      <RailGroup label="Explore">
        <RailItem icon="FileText" label="Playground" active={tab === 'build'} onClick={() => setTab('build')} />
        <RailItem icon="History" label="History" active={tab === 'history'} onClick={() => setTab('history')} count={versions.filter((v) => v.workspaceId === ws).length} />
        <RailItem icon="Workflow" label="Automations" active={tab === 'automations'} onClick={() => setTab('automations')} />
      </RailGroup>
      <RailGroup label="Build">
        {EXAMPLES.slice(0, 4).map((e) => <RailItem key={e.text} icon={e.icon} label={e.mode} onClick={() => { setTab('build'); setRequest(e.text); setOut(null); setSteps([]) }} />)}
      </RailGroup>
      <RailGroup label="Manage">
        <RailItem icon="LayoutDashboard" label="Open my CRM" onClick={() => go('/')} />
      </RailGroup>
      <div className="mt-auto px-1"><StatusBadge status={status.status} label={status.label} externalAutomation={externalAutomation} /></div>
    </>
  )

  const prompt = (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-line bg-surface px-3 py-2.5 focus-within:border-primary/60">
        <textarea id="genius-request" aria-label="What should Genius do?" className="block max-h-40 min-h-[44px] w-full resize-none bg-transparent text-sm text-fg outline-none placeholder:text-muted" value={request} onChange={(e) => setRequest(e.target.value)} onKeyDown={onKey} disabled={running} maxLength={40000} placeholder="Start typing a prompt: describe a CRM to build, a change to make, or ask about your data" rows={2} />
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[11px] text-muted">{request.length > 0 ? `${request.length.toLocaleString()} / 40,000 characters` : 'Ctrl/⌘ + Enter to run'}</span>
          <div className="ml-auto flex items-center gap-2">
            {request && !running && <button type="button" className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-subtle" onClick={() => { setRequest(''); setOut(null); setSteps([]) }}>Clear</button>}
            {running && <button type="button" className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-subtle" onClick={cancel}>Cancel</button>}
            <button type="button" onClick={() => void run(request)} disabled={running || !request.trim()} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-sm font-medium text-[#0b1220] transition disabled:opacity-40">{running ? 'Running…' : 'Run'}<Icon name="Send" size={13} /></button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <StudioFrame rail={rail} settings={<RunSettings health={health} />} prompt={tab === 'build' ? prompt : <div className="h-1" />}>
      {health === 'unreachable' && <div className="mb-4"><Notice tone="warning">The AI service could not be reached. Exact changes, explanations and undo still work offline.</Notice></div>}
      {health && health !== 'unreachable' && !health.geminiConfigured && <div className="mb-4"><Notice tone="warning"><strong>The AI model is not connected yet.</strong> The server secret <code>GEMINI_API_KEY</code> has not been added. Until then only changes made directly by code (rename, switch a workflow off, explain a calculation, undo) work.</Notice></div>}
      {!canBuild && <div className="mb-4"><Notice tone="info">Your role cannot change the CRM configuration, so you can ask questions but not apply changes.</Notice></div>}

      {tab === 'history' && <HistoryPanel canUndo={canBuild} />}
      {tab === 'automations' && <AutomationsPanel canManage={perms.can('manageWorkflows')} />}

      {tab === 'build' && (
        <div className="mx-auto w-full max-w-4xl space-y-4" aria-live="polite">
          {!out && !running && !shown && !clarifyQs && steps.length === 0 && (
            <div className="grid items-center gap-8 py-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
              <div>
                <h1 className="text-3xl font-medium leading-tight">Start building with<br />{strongModel}</h1>
                <p className="mt-3 text-sm text-muted">Describe your business in plain words. Genius designs the CRM, checks every part, shows you a preview, and only builds it when you press Apply.</p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {EXAMPLES.slice(0, 3).map((e) => (
                    <li key={e.text}><button type="button" className="text-left text-fg/90 transition hover:text-primary" onClick={() => { setRequest(e.text); setOut(null); setSteps([]) }}>{e.text}</button></li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="studio-glow absolute -inset-1 rounded-3xl" aria-hidden />
                <div className="relative rounded-2xl"><CrmPreview blueprint={SAMPLE_BLUEPRINT} /></div>
                <p className="mt-2 text-center text-[11px] text-muted">Sample preview. Yours appears here after you run a prompt.</p>
              </div>
            </div>
          )}

          {(steps.length > 0 || running || saveStep) && <Card className="p-4"><h2 className="mb-2 text-sm font-semibold">What Genius is doing</h2><StepList steps={saveStep ? [...steps, saveStep] : steps} running={running} /></Card>}

          {out?.kind === 'error' && (
            <Notice tone="danger">
              <strong>{out.message}</strong>
              <p className="mt-1 text-xs text-muted">Your request is kept in the box below, so you can send it again.{out.retryable ? '' : ' Reword or shorten it first if this keeps happening.'}</p>
              <div className="mt-2 flex gap-2">{out.retryable && <Button size="xs" icon="RefreshCw" onClick={() => void run(request)}>Try again</Button>}</div>
            </Notice>
          )}
          {out?.kind === 'answer' && (
            <Card className="space-y-2 p-4">
              <div className="flex items-center gap-2"><Icon name="MessageSquare" size={15} className="text-primary" /><h2 className="text-sm font-semibold">Answer</h2><Badge>{out.source === 'deterministic' ? 'from your configuration, no AI' : 'AI answer, nothing changed'}</Badge></div>
              <p className="whitespace-pre-wrap text-[13px]">{out.text}</p>
              {out.references.length > 0 && <p className="text-xs text-muted">Based on: {out.references.join(', ')}</p>}
            </Card>
          )}
          {out?.kind === 'restore' && (
            <Card className="space-y-3 p-4">
              <div className="flex items-center gap-2"><Icon name="RotateCcw" size={15} className="text-primary" /><h2 className="text-sm font-semibold">Undo</h2></div>
              <p className="whitespace-pre-wrap text-[13px]">{out.text}</p>
              {out.target && <Button icon="RotateCcw" onClick={() => { setTab('history') }}>Open History to confirm the undo</Button>}
            </Card>
          )}
          {clarifyQs && (
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold">Before I design this</h2>
              <ClarifyForm questions={clarifyQs} disabled={running} onSubmit={(a) => void run(request, a)} />
            </Card>
          )}
          {blueprintShown && <CrmPreview blueprint={blueprintShown} />}
          {diagnostics && <RepairPanel diagnostics={diagnostics} />}
          {shown && <ProposalView proposal={shown} report={out?.kind === 'proposal' && out.proposal.id === shown.id ? out.outcome.report : undefined} cfg={readConfig(ws)} onAccept={() => void accept()} onReject={reject} saving={saving} canApply={canBuild} deterministic={out?.kind === 'proposal' ? out.deterministic : false} />}
          {shown?.state === 'accepted' && shown.needsApproval.length > 0 && (
            <Notice tone="info" icon="ShieldCheck">Applied. The automations are switched off. <button type="button" className="font-medium text-primary underline" onClick={() => setTab('automations')}>Review and approve them</button> when you are ready.</Notice>
          )}
          <details className="rounded-xl border border-line bg-surface p-4 text-[13px]">
            <summary className="cursor-pointer text-sm font-semibold">What Genius can and cannot do</summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">{LIMITS.map((l) => <li key={l}>{l}</li>)}</ul>
          </details>
        </div>
      )}
    </StudioFrame>
  )
}

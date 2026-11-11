import { createFileRoute } from '@tanstack/react-router'
import { CrmPreview } from '#/components/genius/CrmPreview'
import { RailGroup, RailItem, RunSettings, StudioFrame } from '#/components/genius/Studio'
import { Icon } from '#/components/ui/Icon'
import { SAMPLE_BLUEPRINT } from '#/genius/sampleBlueprint'
import type { HealthInfo } from '#/genius/server/handlers'

/** Public, read-only demo of the Studio layout with a hand-written sample CRM. No sign-in, no model call, nothing is saved. */
const DEMO_HEALTH: HealthInfo = {
  geminiConfigured: true,
  provider: 'gemini',
  deepseek: { enabled: false, reason: 'disabled: needs DEEPSEEK_API_KEY and DEEPSEEK_ALLOW_PAID_USAGE=true' },
  quota: [{ model: 'gemini-3.8-flash', requestsLastMinute: 1, tokensLastMinute: 9200, requestsToday: 12, limits: { rpm: 10, tpm: 250000, rpd: 250 } }],
  models: { fast: 'gemini-3.5-flash-lite', strong: 'gemini-3.8-flash' },
  thinking: { fast: 'low', strong: 'medium' },
  strictJsonSchema: { fast: true, strong: true },
  promptCaching: { fast: true, strong: true },
  supabaseConfigured: true,
}

export const Route = createFileRoute('/genius-preview')({
  head: () => ({ meta: [{ title: 'Genius AI Studio · sample preview' }] }),
  component: Demo,
})

function Demo() {
  return (
    <div className="studio min-h-screen p-0 sm:p-4">
      <StudioFrame
        rail={
          <>
            <div className="mb-4 flex items-center gap-2 px-2 pt-1"><Icon name="Sparkles" size={18} className="text-primary" /><span className="text-[15px] font-semibold">Genius AI Studio</span></div>
            <RailGroup label="Explore"><RailItem icon="FileText" label="Playground" active /><RailItem icon="History" label="History" /><RailItem icon="Workflow" label="Automations" /></RailGroup>
            <RailGroup label="Build"><RailItem icon="Sparkles" label="New build" /><RailItem icon="Plus" label="Extend" /><RailItem icon="Scale" label="Change a rule" /><RailItem icon="MessageSquare" label="Ask" /></RailGroup>
            <RailGroup label="Manage"><RailItem icon="LayoutDashboard" label="Open my CRM" /></RailGroup>
          </>
        }
        settings={<RunSettings health={DEMO_HEALTH} sample />}
        prompt={<div className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">Start typing a prompt: describe a CRM to build, a change to make, or ask about your data</div>}
      >
        <div className="mx-auto max-w-4xl space-y-4">
          <div><h1 className="text-2xl font-medium">Hostel manager</h1><p className="mt-1 text-sm text-muted">Sample CRM preview: five connected modules, a pipeline and a dashboard, as Genius shows it before anything is saved.</p></div>
          <CrmPreview blueprint={SAMPLE_BLUEPRINT} />
        </div>
      </StudioFrame>
    </div>
  )
}

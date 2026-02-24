import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Clock3 } from 'lucide-react'

interface StudioWorkspaceProps {
  projectName: string
  seriesTitle: string
  onBack: () => void
}

export function StudioWorkspace({ projectName, seriesTitle }: StudioWorkspaceProps) {
  const { t } = useTranslation()
  const [studioContent, setStudioContent] = useState('')

  const workflowSteps = useMemo(
    () => [
      t('projectLibrary.stepScript'),
      t('projectLibrary.stepCharacter'),
      t('projectLibrary.stepStoryboard'),
      t('projectLibrary.stepShot'),
      t('projectLibrary.stepProduction'),
      t('projectLibrary.stepExport'),
    ],
    [t],
  )

  const contentLength = studioContent.trim().length

  return (
    <main className="h-full w-full overflow-auto bg-linear-to-br from-base-200/40 via-base-100 to-base-200/30 text-base-content">
      <div className="sticky top-0 z-10 border-b border-base-300 bg-base-100/90 backdrop-blur">
        <div className="relative px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{projectName}</p>
              <p className="truncate text-xs text-base-content/60">{seriesTitle}</p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs absolute left-1/2 -translate-x-1/2">
            {workflowSteps.map((step, idx) => (
              <span
                key={step}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 border ${idx === 0 ? 'border-primary/40 bg-primary/10 text-primary' : 'border-base-300 text-base-content/50'}`}
              >
                <CheckCircle2 size={12} className={idx === 0 ? 'text-primary' : 'text-base-content/50'} />
                {step}
              </span>
            ))}
          </div>

        </div>
      </div>

      <div className="p-5">
        <div className="rounded-xl border border-base-300 bg-base-100/90 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t('projectLibrary.scriptContent')}</h2>
            <span className="text-xs text-base-content/60">{contentLength} / 3000</span>
          </div>
          <textarea
            className="h-[calc(100vh-180px)] w-full resize-none rounded-lg border border-base-300 bg-base-100 p-4 text-sm leading-7 text-base-content outline-none placeholder:text-base-content/40 focus:border-primary"
            placeholder={t('projectLibrary.studioPlaceholder')}
            value={studioContent}
            onChange={(e) => setStudioContent(e.target.value)}
          />
          <div className="mt-2 text-xs text-base-content/50 inline-flex items-center gap-1">
            <Clock3 size={11} />
            {t('projectLibrary.autoSavedHint')}
          </div>
        </div>
      </div>
    </main>
  )
}

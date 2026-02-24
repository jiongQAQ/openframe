import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'
import { ScriptEditor } from './ScriptEditor'
import { seriesCollection } from '../db/series_collection'

interface StudioWorkspaceProps {
  seriesId: string
  projectName: string
  seriesTitle: string
  scriptContent: string
}

export function StudioWorkspace({ seriesId, projectName, seriesTitle, scriptContent }: StudioWorkspaceProps) {
  const { t } = useTranslation()

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

  return (
    <main className="h-full w-full overflow-hidden flex flex-col bg-linear-to-br from-base-200/40 via-base-100 to-base-200/30 text-base-content">
      <div className="sticky top-0 z-10 border-b border-base-300 bg-base-100/90 backdrop-blur">
        <div className="relative px-4 py-3 flex items-center justify-center">
          <div className="absolute left-4 min-w-0">
            <p className="truncate text-sm font-semibold">{projectName}</p>
            <p className="truncate text-xs text-base-content/60">{seriesTitle}</p>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs">
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

      <div className="p-5 flex-1 min-h-0">
        <ScriptEditor
          content={scriptContent}
          onContentChange={(nextContent) => {
            if (!seriesId) return
            seriesCollection.update(seriesId, (draft) => {
              draft.script = nextContent
            })
          }}
        />
      </div>
    </main>
  )
}

import { useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Clapperboard, FolderOpen, Image, MapPin, PlusCircle, RefreshCw, ScrollText, Sparkles, Trash2, Upload, X } from 'lucide-react'

type ModelOption = {
  key: string
  label: string
}

type SceneCard = {
  id: string
  series_id: string
  title: string
  location: string
  time: string
  mood: string
  description: string
  shot_notes: string
  thumbnail: string | null
  created_at: number
}

type CreateSceneDraft = {
  title: string
  location: string
  time: string
  mood: string
  description: string
  shot_notes: string
  thumbnail: string | null
}

export type { CreateSceneDraft }

interface ScenePanelProps {
  scenes: SceneCard[]
  extractingFromScript: boolean
  extractingRegenerate: boolean
  sceneBusyId: string | null
  textModelOptions: ModelOption[]
  selectedTextModelKey: string
  onTextModelChange: (modelKey: string) => void
  imageModelOptions: ModelOption[]
  selectedImageModelKey: string
  onImageModelChange: (modelKey: string) => void
  onAddScene: (draft: CreateSceneDraft) => void
  onUpdateScene: (id: string, draft: CreateSceneDraft) => void
  onSmartGenerateScene: (draft: CreateSceneDraft) => Promise<{ ok: true; draft: CreateSceneDraft } | { ok: false; error: string }>
  onExtractFromScript: () => void
  onRegenerateFromScript: () => void
  onDeleteScene: (id: string, title: string) => void
  onEnhanceScene: (id: string) => void
  onRefreshScene: (id: string) => void
  onGenerateSceneImage: (id: string) => void
  onUploadSceneImage: (id: string) => void
}

function getThumbnailSrc(value: string | null): string | null {
  if (!value) return null
  if (/^(https?:|data:|blob:|openframe-thumb:)/i.test(value)) return value
  return `openframe-thumb://local?path=${encodeURIComponent(value)}`
}

export function ScenePanel({
  scenes,
  extractingFromScript,
  extractingRegenerate,
  sceneBusyId,
  textModelOptions,
  selectedTextModelKey,
  onTextModelChange,
  imageModelOptions,
  selectedImageModelKey,
  onImageModelChange,
  onAddScene,
  onUpdateScene,
  onSmartGenerateScene,
  onExtractFromScript,
  onRegenerateFromScript,
  onDeleteScene,
  onEnhanceScene,
  onRefreshScene,
  onGenerateSceneImage,
  onUploadSceneImage,
}: ScenePanelProps) {
  const { t } = useTranslation()
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createUploading, setCreateUploading] = useState(false)
  const [createGenerating, setCreateGenerating] = useState(false)
  const createUploadInputRef = useRef<HTMLInputElement | null>(null)
  const [createDraft, setCreateDraft] = useState<CreateSceneDraft>({
    title: '',
    location: '',
    time: '',
    mood: '',
    description: '',
    shot_notes: '',
    thumbnail: null,
  })

  function handleOpenCreate() {
    setEditingSceneId(null)
    setCreateError('')
    setCreateDraft({ title: '', location: '', time: '', mood: '', description: '', shot_notes: '', thumbnail: null })
    setCreateOpen(true)
  }

  function handleOpenEdit(scene: SceneCard) {
    setEditingSceneId(scene.id)
    setCreateError('')
    setCreateDraft({
      title: scene.title,
      location: scene.location,
      time: scene.time,
      mood: scene.mood,
      description: scene.description,
      shot_notes: scene.shot_notes,
      thumbnail: scene.thumbnail,
    })
    setCreateOpen(true)
  }

  async function handleSmartGenerate() {
    if (!createDraft.title.trim()) {
      setCreateError(t('projectLibrary.sceneTitleRequired'))
      return
    }
    setCreateGenerating(true)
    setCreateError('')
    try {
      const result = await onSmartGenerateScene(createDraft)
      if (!result.ok) {
        setCreateError(result.error)
        return
      }
      setCreateDraft(result.draft)
    } finally {
      setCreateGenerating(false)
    }
  }

  function extFromFile(file: File): string {
    const fromName = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : ''
    if (fromName) return fromName
    if (file.type === 'image/jpeg') return 'jpg'
    if (file.type === 'image/png') return 'png'
    if (file.type === 'image/webp') return 'webp'
    if (file.type === 'image/gif') return 'gif'
    return 'png'
  }

  async function handleCreateUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setCreateUploading(true)
    setCreateError('')
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      const savedPath = await window.thumbnailsAPI.save(buf, extFromFile(file))
      setCreateDraft((prev) => ({ ...prev, thumbnail: savedPath }))
    } catch {
      setCreateError(t('projectLibrary.saveError'))
    } finally {
      setCreateUploading(false)
    }
  }

  function handleCreateSubmit() {
    if (!createDraft.title.trim()) {
      setCreateError(t('projectLibrary.sceneTitleRequired'))
      return
    }
    const payload: CreateSceneDraft = {
      title: createDraft.title.trim(),
      location: createDraft.location.trim(),
      time: createDraft.time.trim(),
      mood: createDraft.mood.trim(),
      description: createDraft.description.trim(),
      shot_notes: createDraft.shot_notes.trim(),
      thumbnail: createDraft.thumbnail,
    }
    if (editingSceneId) onUpdateScene(editingSceneId, payload)
    else onAddScene(payload)
    setCreateOpen(false)
  }

  return (
    <section className="h-full rounded-2xl border border-base-300 bg-linear-to-br from-base-200/30 via-base-100 to-base-200/20 text-base-content p-4 md:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-wide">{t('projectLibrary.scenePanelTitle')}</h2>
          <p className="text-xs text-base-content/60 mt-1">{t('projectLibrary.scenePanelSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-sm btn-outline" onClick={onExtractFromScript} disabled={extractingFromScript || extractingRegenerate}>
            <FolderOpen size={12} />
            {extractingFromScript ? t('projectLibrary.aiStreaming') : t('projectLibrary.sceneFromDraft')}
          </button>
          <button type="button" className="btn btn-sm btn-outline" onClick={onRegenerateFromScript} disabled={extractingFromScript || extractingRegenerate}>
            <RefreshCw size={12} />
            {extractingRegenerate ? t('projectLibrary.aiStreaming') : t('projectLibrary.sceneRegenerate')}
          </button>
          <label className="input input-sm input-bordered flex items-center gap-2 w-56">
            <ScrollText size={12} className="text-base-content/60" />
            <select className="w-full bg-transparent outline-none" value={selectedTextModelKey} onChange={(event) => onTextModelChange(event.target.value)}>
              {textModelOptions.length === 0 ? <option value="">{t('projectLibrary.aiModelEmpty')}</option> : textModelOptions.map((model) => <option key={model.key} value={model.key}>{model.label}</option>)}
            </select>
          </label>
          <label className="input input-sm input-bordered flex items-center gap-2 w-56">
            <Sparkles size={12} className="text-base-content/60" />
            <select className="w-full bg-transparent outline-none" value={selectedImageModelKey} onChange={(event) => onImageModelChange(event.target.value)}>
              {imageModelOptions.length === 0 ? <option value="">{t('projectLibrary.characterModelEmpty')}</option> : imageModelOptions.map((model) => <option key={model.key} value={model.key}>{model.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-wrap items-start gap-3 pr-2">
          <article className="w-56 h-105 shrink-0 rounded-xl border border-dashed border-base-300 bg-base-100/70 flex flex-col items-center justify-center gap-3 text-base-content/75 cursor-pointer hover:border-primary/40 hover:bg-base-100 transition-colors" onClick={handleOpenCreate}>
            <PlusCircle size={24} className="text-base-content/55" />
            <p className="text-sm font-medium">{t('projectLibrary.sceneSetup')}</p>
            <p className="text-xs text-base-content/55">{t('projectLibrary.sceneEmptyHint')}</p>
          </article>

          {scenes.map((scene) => (
            <article key={scene.id} className="w-56 h-105 shrink-0 rounded-xl border border-base-300 bg-base-100 overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleOpenEdit(scene)}>
              <div className="h-44 border-b border-base-300 bg-linear-to-b from-base-200 via-base-100 to-base-200/70 flex items-end justify-center">
                {getThumbnailSrc(scene.thumbnail) ? <img src={getThumbnailSrc(scene.thumbnail)!} alt={scene.title} className="h-full w-full object-cover" /> : <Clapperboard size={38} className="mb-4 text-base-content/50" />}
              </div>
              <div className="p-3 flex-1 min-h-0 flex flex-col">
                <p className="text-base font-semibold line-clamp-1">{scene.title || t('projectLibrary.sceneCardUntitled')}</p>
                <div className="mt-2 flex gap-1 text-xs text-base-content/65"><MapPin size={12} className="shrink-0 mt-0.5" /><span className="line-clamp-1">{[scene.location, scene.time].filter(Boolean).join(' · ') || '-'}</span></div>
                <div className="mt-2 flex gap-1 text-xs text-base-content/65"><Sparkles size={12} className="shrink-0 mt-0.5" /><span className="line-clamp-2 wrap-break-word">{scene.mood || '-'}</span></div>
                <div className="mt-2 flex gap-1 text-xs text-base-content/65"><ScrollText size={12} className="shrink-0 mt-0.5" /><span className="line-clamp-2 wrap-break-word">{scene.description || '-'}</span></div>

                <div className="mt-auto pt-3 border-t border-base-300 flex items-center justify-center gap-1">
                  <button type="button" className="btn btn-xs btn-outline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEnhanceScene(scene.id) }} disabled={sceneBusyId === scene.id || extractingFromScript || extractingRegenerate} title={t('projectLibrary.sceneEnhanceSingle')}><Sparkles size={12} /></button>
                  <button type="button" className="btn btn-xs btn-outline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRefreshScene(scene.id) }} disabled={sceneBusyId === scene.id || extractingFromScript || extractingRegenerate} title={t('projectLibrary.sceneRefreshSingle')}><RefreshCw size={12} /></button>
                  <button type="button" className="btn btn-xs btn-outline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUploadSceneImage(scene.id) }} disabled={sceneBusyId === scene.id} title={t('projectLibrary.sceneUploadImage')}><Upload size={12} /></button>
                  <button type="button" className="btn btn-xs btn-outline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onGenerateSceneImage(scene.id) }} disabled={sceneBusyId === scene.id || extractingFromScript || extractingRegenerate} title={t('projectLibrary.sceneGenerateImage')}><Image size={12} /></button>
                  <button type="button" className="btn btn-xs btn-outline text-error border-error/40 hover:bg-error/10" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteScene(scene.id, scene.title) }} disabled={sceneBusyId === scene.id} title={t('projectLibrary.delete')}><Trash2 size={12} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-base-content/35" aria-label={t('projectLibrary.close')} onClick={() => setCreateOpen(false)} />
          <article className="relative z-10 w-full max-w-6xl rounded-2xl border border-base-300 bg-base-100 shadow-2xl overflow-hidden">
            <div className="border-b border-base-300 bg-linear-to-r from-base-200/60 via-base-100 to-base-200/30 px-5 py-4 md:px-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editingSceneId ? t('projectLibrary.sceneEditTitle') : t('projectLibrary.sceneCreateTitle')}</h3>
              <button type="button" className="btn btn-sm btn-ghost btn-circle" onClick={() => setCreateOpen(false)}><X size={16} /></button>
            </div>
            <div className="p-5 md:p-6 max-h-[70vh] overflow-auto">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4">
                <aside className="rounded-xl border border-base-300 bg-linear-to-br from-base-200/90 via-base-100 to-base-200/70 p-4 min-h-130 flex flex-col items-center justify-center gap-4">
                  {getThumbnailSrc(createDraft.thumbnail) ? <img src={getThumbnailSrc(createDraft.thumbnail)!} alt={createDraft.title || 'scene'} className="h-full w-full rounded-lg object-cover" /> : <Clapperboard size={48} className="text-base-content/55" />}
                  <p className="text-sm font-medium text-center wrap-break-word">{createDraft.title.trim() || t('projectLibrary.sceneTitleLabel')}</p>
                  <div className="flex flex-col gap-2 w-full max-w-52">
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => createUploadInputRef.current?.click()} disabled={createUploading || createGenerating}><Upload size={14} />{createUploading ? t('projectLibrary.aiStreaming') : t('projectLibrary.characterManualUpload')}</button>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => void handleSmartGenerate()} disabled={createUploading || createGenerating}><Sparkles size={14} />{createGenerating ? t('projectLibrary.aiStreaming') : t('projectLibrary.characterSmartGenerate')}</button>
                    <input ref={createUploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleCreateUploadChange} />
                  </div>
                </aside>
                <div className="grid grid-cols-1 gap-3 content-start">
                  <label className="form-control flex flex-col items-start gap-1"><span className="text-sm font-medium text-base-content/75">{t('projectLibrary.sceneTitleLabel')}</span><input className="input input-bordered input-md" placeholder={t('projectLibrary.sceneTitlePlaceholder')} value={createDraft.title} onChange={(e) => setCreateDraft((p) => ({ ...p, title: e.target.value }))} /></label>
                  <label className="form-control flex flex-col items-start gap-1"><span className="text-sm font-medium text-base-content/75">{t('projectLibrary.sceneLocationLabel')}</span><input className="input input-bordered input-md" placeholder={t('projectLibrary.sceneLocationPlaceholder')} value={createDraft.location} onChange={(e) => setCreateDraft((p) => ({ ...p, location: e.target.value }))} /></label>
                  <label className="form-control flex flex-col items-start gap-1"><span className="text-sm font-medium text-base-content/75">{t('projectLibrary.sceneTimeLabel')}</span><input className="input input-bordered input-md" placeholder={t('projectLibrary.sceneTimePlaceholder')} value={createDraft.time} onChange={(e) => setCreateDraft((p) => ({ ...p, time: e.target.value }))} /></label>
                  <label className="form-control flex flex-col items-start gap-1"><span className="text-sm font-medium text-base-content/75">{t('projectLibrary.sceneMoodLabel')}</span><input className="input input-bordered input-md" placeholder={t('projectLibrary.sceneMoodPlaceholder')} value={createDraft.mood} onChange={(e) => setCreateDraft((p) => ({ ...p, mood: e.target.value }))} /></label>
                  <label className="form-control flex flex-col items-start gap-1"><span className="text-sm font-medium text-base-content/75">{t('projectLibrary.sceneDescriptionLabel')}</span><textarea className="textarea textarea-bordered min-h-24" placeholder={t('projectLibrary.sceneDescriptionPlaceholder')} value={createDraft.description} onChange={(e) => setCreateDraft((p) => ({ ...p, description: e.target.value }))} /></label>
                  <label className="form-control flex flex-col items-start gap-1"><span className="text-sm font-medium text-base-content/75">{t('projectLibrary.sceneShotNotesLabel')}</span><textarea className="textarea textarea-bordered min-h-24" placeholder={t('projectLibrary.sceneShotNotesPlaceholder')} value={createDraft.shot_notes} onChange={(e) => setCreateDraft((p) => ({ ...p, shot_notes: e.target.value }))} /></label>
                </div>
              </div>
              {createError ? <p className="text-error text-xs mt-3">{createError}</p> : null}
            </div>
            <div className="border-t border-base-300 bg-base-100 px-5 py-3 md:px-6 flex items-center justify-end gap-2">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCreateOpen(false)}>{t('projectLibrary.sceneCreateCancel')}</button>
              <button type="button" className="btn btn-sm btn-primary" onClick={handleCreateSubmit}>{editingSceneId ? t('projectLibrary.sceneUpdateConfirm') : t('projectLibrary.sceneCreateConfirm')}</button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  )
}

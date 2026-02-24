import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Image, PlusCircle, RefreshCw, ScrollText, Sparkles, Trash2, Upload, User } from 'lucide-react'
import type { Character } from '../db/characters_collection'

type ModelOption = {
  key: string
  label: string
}

interface CharacterPanelProps {
  characters: Character[]
  extractingFromDraft: boolean
  extractingRegenerate: boolean
  characterBusyId: string | null
  imageModelOptions: ModelOption[]
  selectedImageModelKey: string
  onImageModelChange: (modelKey: string) => void
  onExtractFromScript: () => void
  onRegenerateFromScript: () => void
  onDeleteCharacter: (id: string, name: string) => void
  onEnhanceCharacter: (id: string) => void
  onRefreshCharacter: (id: string) => void
  onGenerateTurnaround: (id: string) => void
  onUploadCharacter: (id: string) => void
}

function getThumbnailSrc(value: string | null): string | null {
  if (!value) return null
  if (/^(https?:|data:|blob:|openframe-thumb:)/i.test(value)) return value
  return `openframe-thumb://local?path=${encodeURIComponent(value)}`
}

export function CharacterPanel({
  characters,
  extractingFromDraft,
  extractingRegenerate,
  characterBusyId,
  imageModelOptions,
  selectedImageModelKey,
  onImageModelChange,
  onExtractFromScript,
  onRegenerateFromScript,
  onDeleteCharacter,
  onEnhanceCharacter,
  onRefreshCharacter,
  onGenerateTurnaround,
  onUploadCharacter,
}: CharacterPanelProps) {
  const { t } = useTranslation()
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)

  const selectedCharacter = useMemo(
    () => (selectedCharacterId ? characters.find((item) => item.id === selectedCharacterId) ?? null : null),
    [characters, selectedCharacterId],
  )

  useEffect(() => {
    if (!selectedCharacterId) return
    if (characters.some((item) => item.id === selectedCharacterId)) return
    setSelectedCharacterId(null)
  }, [characters, selectedCharacterId])

  return (
    <section className="h-full rounded-2xl border border-base-300 bg-linear-to-br from-base-200/30 via-base-100 to-base-200/20 text-base-content p-4 md:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-wide">{t('projectLibrary.characterPanelTitle')}</h2>
          <p className="text-xs text-base-content/60 mt-1">{t('projectLibrary.characterPanelSubtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={onExtractFromScript}
            disabled={extractingFromDraft || extractingRegenerate}
          >
            <FolderOpen size={12} />
            {extractingFromDraft ? t('projectLibrary.aiStreaming') : t('projectLibrary.characterFromDraft')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={onRegenerateFromScript}
            disabled={extractingFromDraft || extractingRegenerate}
          >
            <RefreshCw size={12} />
            {extractingRegenerate ? t('projectLibrary.aiStreaming') : t('projectLibrary.characterRegenerate')}
          </button>
          <label className="input input-sm input-bordered flex items-center gap-2 w-56">
            <Sparkles size={12} className="text-base-content/60" />
            <select
              className="w-full bg-transparent outline-none"
              value={selectedImageModelKey}
              onChange={(event) => onImageModelChange(event.target.value)}
            >
              {imageModelOptions.length === 0 ? (
                <option value="">{t('projectLibrary.characterModelEmpty')}</option>
              ) : (
                imageModelOptions.map((model) => (
                  <option key={model.key} value={model.key}>
                    {model.label}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-wrap items-start gap-3 pr-2">
          <article className="w-56 h-105 shrink-0 rounded-xl border border-dashed border-base-300 bg-base-100/70 flex flex-col items-center justify-center gap-3 text-base-content/75">
            <PlusCircle size={24} className="text-base-content/55" />
            <p className="text-sm font-medium">{t('projectLibrary.characterSetup')}</p>
            <p className="text-xs text-base-content/55">{t('projectLibrary.characterEmptyHint')}</p>
          </article>

          {characters.map((card) => (
            <article
              key={card.id}
              className="w-56 h-105 shrink-0 rounded-xl border border-base-300 bg-base-100 overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedCharacterId(card.id)}
            >
              <div className="h-44 border-b border-base-300 bg-linear-to-b from-base-200 via-base-100 to-base-200/70 flex items-end justify-center">
                {getThumbnailSrc(card.thumbnail) ? (
                  <img src={getThumbnailSrc(card.thumbnail)!} alt={card.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="mb-4 size-20 rounded-full bg-linear-to-br from-primary/70 to-primary text-primary-content flex items-center justify-center text-xl font-bold shadow-lg">
                    {card.name.slice(0, 1) || '?'}
                  </div>
                )}
              </div>

              <div className="p-3 flex-1 min-h-0 flex flex-col">
                <p className="text-base font-semibold">{card.name}</p>
                <p className="mt-2 text-xs text-base-content/65 inline-flex items-center gap-1"><User size={12} />{[card.gender, card.age].filter(Boolean).join('，') || '-'}</p>
                <div className="mt-2 flex gap-1 text-xs text-base-content/65">
                  <Sparkles size={12} className="shrink-0 mt-0.5" />
                  <span className="line-clamp-2 overflow-hidden text-ellipsis break-words">{card.personality || '-'}</span>
                </div>
                <div className="mt-2 flex gap-1 text-xs text-base-content/65">
                  <Upload size={12} className="shrink-0 mt-0.5" />
                  <span className="line-clamp-2 overflow-hidden text-ellipsis break-words">{card.appearance || '-'}</span>
                </div>
                <div className="mt-2 flex gap-1 text-xs text-base-content/65">
                  <ScrollText size={12} className="shrink-0 mt-0.5" />
                  <span className="line-clamp-2 overflow-hidden text-ellipsis break-words">{card.background || '-'}</span>
                </div>

                <div className="mt-auto pt-3 border-t border-base-300 flex items-center justify-center gap-1">
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onEnhanceCharacter(card.id)
                    }}
                    disabled={characterBusyId === card.id || extractingFromDraft || extractingRegenerate}
                    title={t('projectLibrary.characterEnhanceSingle')}
                  ><Sparkles size={12} /></button>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onRefreshCharacter(card.id)
                    }}
                    disabled={characterBusyId === card.id || extractingFromDraft || extractingRegenerate}
                    title={t('projectLibrary.characterRefreshSingle')}
                  ><RefreshCw size={12} /></button>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onUploadCharacter(card.id)
                    }}
                    disabled={characterBusyId === card.id}
                    title={t('projectLibrary.characterUploadImage')}
                  ><Upload size={12} /></button>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onGenerateTurnaround(card.id)
                    }}
                    disabled={characterBusyId === card.id || extractingFromDraft || extractingRegenerate}
                    title={t('projectLibrary.characterGenerateTurnaround')}
                  ><Image size={12} /></button>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline text-error border-error/40 hover:bg-error/10"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onDeleteCharacter(card.id, card.name)
                    }}
                    disabled={characterBusyId === card.id}
                    title={t('projectLibrary.delete')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {selectedCharacter ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-base-content/35"
            aria-label={t('projectLibrary.close')}
            onClick={() => setSelectedCharacterId(null)}
          />
          <article className="relative z-10 w-full max-w-3xl rounded-2xl border border-base-300 bg-base-100 shadow-xl overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)]">
              <div className="bg-base-200/50 min-h-80 flex items-center justify-center">
                {getThumbnailSrc(selectedCharacter.thumbnail) ? (
                  <img
                    src={getThumbnailSrc(selectedCharacter.thumbnail)!}
                    alt={selectedCharacter.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="size-28 rounded-full bg-linear-to-br from-primary/70 to-primary text-primary-content flex items-center justify-center text-4xl font-bold shadow-lg">
                    {selectedCharacter.name.slice(0, 1) || '?'}
                  </div>
                )}
              </div>

              <div className="p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-semibold">{selectedCharacter.name}</h3>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelectedCharacterId(null)}>
                    {t('projectLibrary.close')}
                  </button>
                </div>

                <div className="mt-3 space-y-3 text-sm">
                  <p><span className="font-medium">{t('projectLibrary.characterGenderLabel')}:</span> {selectedCharacter.gender || '-'}</p>
                  <p><span className="font-medium">{t('projectLibrary.characterAgeLabel')}:</span> {selectedCharacter.age || '-'}</p>
                  <p><span className="font-medium">{t('projectLibrary.characterPersonalityLabel')}:</span> {selectedCharacter.personality || '-'}</p>
                  <p><span className="font-medium">{t('projectLibrary.characterAppearanceLabel')}:</span> {selectedCharacter.appearance || '-'}</p>
                  <p><span className="font-medium">{t('projectLibrary.characterBackgroundLabel')}:</span> {selectedCharacter.background || '-'}</p>
                </div>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  )
}

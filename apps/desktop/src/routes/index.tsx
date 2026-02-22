import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/')({
  component: OverviewPage,
})

function OverviewPage() {
  const { t } = useTranslation()
  return (
    <main className="flex-1 p-6">
      <h1 className="text-2xl font-bold mb-2">{t('content.overviewTitle')}</h1>
      <p className="text-base-content/60">{t('content.overviewDesc')}</p>
    </main>
  )
}

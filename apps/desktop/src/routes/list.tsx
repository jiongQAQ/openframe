import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/list')({
  component: ListPage,
})

function ListPage() {
  const { t } = useTranslation()
  return (
    <main className="flex-1 p-6">
      <h1 className="text-2xl font-bold mb-2">{t('menu.list')}</h1>
    </main>
  )
}

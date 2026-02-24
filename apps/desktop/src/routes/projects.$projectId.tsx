import { createFileRoute } from '@tanstack/react-router'
import { ProjectEditorPage } from '../components/ProjectEditorPage'

export const Route = createFileRoute('/projects/$projectId')({
  component: EditProjectPage,
})

function EditProjectPage() {
  const { projectId } = Route.useParams()
  return <ProjectEditorPage projectId={projectId} />
}

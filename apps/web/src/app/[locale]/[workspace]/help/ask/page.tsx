import { getWorkspaceColumnSet, prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { AskAIClient } from './AskAIClient'

interface Props {
  params: Promise<{ workspace: string }>
}

export default async function AskAIPage(props: Props) {
  const params = await props.params
  const t = await getTranslations('askAI')
  const columns = await getWorkspaceColumnSet()
  const workspace = await prisma.workspace.findFirst({
    where: { slug: params.workspace },
    select: {
      id: true,
      name: true,
      logo: true,
      ...(columns.has('brandText') ? { brandText: true } : {}),
    },
  })
  if (!workspace) notFound()

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-cream flex flex-col">
      {/* Chat — fills remaining height */}
      <div className="flex-1 min-h-0 max-w-2xl w-full mx-auto flex flex-col">
        <AskAIClient workspace={params.workspace} workspaceName={workspace.name} />
      </div>
    </div>
  )
}

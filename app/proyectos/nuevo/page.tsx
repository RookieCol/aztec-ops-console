import Link from 'next/link'
import { CreateProjectForm } from '@/components/CreateProjectForm'

export default function NewProjectPage() {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Volver
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <CreateProjectForm />
      </main>
    </div>
  )
}

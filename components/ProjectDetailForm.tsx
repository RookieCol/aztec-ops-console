'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectView } from '@/lib/engine/types'
import type { Task, ImportIssue, ChangeLogEntry } from '@/lib/db/schema'
import { PROJECT_STATUSES, PRIORITY_LABELS, TASK_STATUSES } from '@/lib/config'
import { updateProjectFields, setNextStepFromTask, unblockTask } from '@/lib/actions'
import { cycleTaskCodes } from '@/lib/engine/dependencies'
import { Modal } from './Modal'

export type ProjectDetailFormProps = {
  view: ProjectView
  issues: ImportIssue[]
  changeLog: ChangeLogEntry[]
}

function formatUsd(value: number | null): string {
  if (value === null || value === undefined) return 'desconocido'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const PRIORITY_DOT: Record<string, string> = {
  Critica: 'bg-red-600 dark:bg-red-500',
  Alta: 'bg-orange-500 dark:bg-orange-400',
  Media: 'bg-amber-400 dark:bg-amber-500',
  Baja: 'bg-slate-400 dark:bg-slate-500',
}

const COLUMN_ACCENT: Record<string, string> = {
  'Por hacer': 'border-t-slate-400 dark:border-t-slate-500',
  'En progreso': 'border-t-sky-500 dark:border-t-sky-400',
  'En revision': 'border-t-amber-500 dark:border-t-amber-400',
  Bloqueada: 'border-t-red-600 dark:border-t-red-500',
}

/**
 * Tarjeta de tarea (tablero Kanban) — de solo lectura + las 2 acciones puntuales, con todos
 * los campos de detalle que existen en el dato (rol, de qué depende, detalle). `detail` y
 * `lastProgress` son siempre idénticos en este dataset (DATASET-HALLAZGOS.md §5: 82 de 82
 * filas) — se muestra uno solo en vez de duplicar el mismo párrafo dos veces.
 */
function TaskCard({ task, projectCode, inCycle }: { task: Task; projectCode: string; inCycle: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<'unblocked' | 'nextstep' | null>(null)
  const router = useRouter()

  function handleUnblock() {
    setError(null)
    startTransition(async () => {
      try {
        await unblockTask(task.code)
        setDone('unblocked')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al desbloquear la tarea')
      }
    })
  }

  function handleUseAsNextStep() {
    setError(null)
    startTransition(async () => {
      try {
        await setNextStepFromTask(projectCode, task.code)
        setDone('nextstep')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al fijar el siguiente paso')
      }
    })
  }

  const detail = task.detail ?? task.lastProgress

  return (
    <li
      className={`flex flex-col gap-2 rounded-md border bg-background px-3 py-2.5 shadow-sm ${
        inCycle
          ? 'border-red-300 dark:border-red-900/60'
          : 'border-black/10 dark:border-white/10'
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] ?? 'bg-foreground/30'}`}
          aria-hidden
          title={`Prioridad ${task.priority}`}
        />
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{task.title}</span>
      </div>

      {inCycle && (
        <span className="w-fit rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
          Ciclo de dependencias
        </span>
      )}

      <p className="text-xs text-foreground/60">
        prioridad {task.priority}
        {task.assigneeAlias
          ? ` · ${task.assigneeAlias}${task.assigneeRole ? ` (${task.assigneeRole})` : ''}`
          : ''}
        {task.dueDate ? ` · vence ${task.dueDate}` : ''}
      </p>

      {task.dependencyTitle && (
        <p className="text-xs text-foreground/60">
          <span className="font-medium">Depende de:</span> {task.dependencyTitle}
        </p>
      )}

      {detail && <p className="text-xs text-foreground/70">{detail}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        {task.status === 'Bloqueada' && (
          <button
            type="button"
            onClick={handleUnblock}
            disabled={isPending}
            className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
          >
            {isPending ? 'Desbloqueando…' : 'Desbloquear'}
          </button>
        )}
        <button
          type="button"
          onClick={handleUseAsNextStep}
          disabled={isPending}
          className="rounded-md border border-black/10 px-2.5 py-1 text-xs font-medium text-foreground/80 transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
        >
          {isPending ? 'Guardando…' : 'Usar como siguiente paso'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {done === 'unblocked' && !error && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Tarea desbloqueada.</p>
      )}
      {done === 'nextstep' && !error && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Siguiente paso del proyecto actualizado.
        </p>
      )}
    </li>
  )
}

/**
 * Tablero tipo Trello: una columna por estado de tarea (`TASK_STATUSES`, el mismo orden que
 * usa el resto del sistema), cada una con sus tarjetas. Las tareas que participan en un
 * ciclo de dependencias (PRJ-04: T02 <-> T03) se marcan con un badge rojo en su propia
 * tarjeta — el ciclo importa sin importar en qué columna de estado caiga cada una.
 */
function TaskBoard({ tasks, projectCode }: { tasks: Task[]; projectCode: string }) {
  const cyclesSet = useMemo(() => cycleTaskCodes(tasks), [tasks])

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const column = tasks.filter((t) => t.status === status)
        return (
          <div
            key={status}
            className={`flex flex-col gap-3 rounded-lg border border-t-4 border-black/10 bg-black/[0.015] p-3 dark:border-white/10 dark:bg-white/[0.02] ${COLUMN_ACCENT[status] ?? ''}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{status}</h3>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-foreground/60 dark:bg-white/10">
                {column.length}
              </span>
            </div>
            {column.length === 0 ? (
              <p className="text-xs text-foreground/40">Sin tareas</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {column.map((task) => (
                  <TaskCard
                    key={task.code}
                    task={task}
                    projectCode={projectCode}
                    inCycle={cyclesSet.has(task.code)}
                  />
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

const inputClass =
  'w-full rounded-md border border-black/15 bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10 dark:border-white/15'

const labelClass = 'text-xs font-medium text-foreground/60'

/**
 * Pantalla de detalle de un proyecto. Las tareas son el canvas principal, en un tablero tipo
 * Trello (una columna por estado) visible de entrada — es el contenido operativo. Los 7
 * campos editables del enunciado (estado, prioridad, responsable, fecha límite, siguiente
 * paso, bloqueos, notas) viven en un modal que solo aparece al pulsar "Editar proyecto":
 * edición es una acción puntual, no algo que deba competir por espacio en pantalla con el
 * tablero.
 */
export function ProjectDetailForm({ view, issues, changeLog }: ProjectDetailFormProps) {
  const { project, fields, tasks, declaredMismatch, flags } = view
  const router = useRouter()

  const [modalOpen, setModalOpen] = useState(false)
  const [status, setStatus] = useState(fields.status)
  const [priorityOverride, setPriorityOverride] = useState<string>(fields.priorityOverride ?? '')
  const [nextStep, setNextStep] = useState(fields.nextStep ?? '')
  const [notes, setNotes] = useState(fields.notes ?? '')
  const [ownerAlias, setOwnerAlias] = useState(project.ownerAlias ?? '')
  const [targetDate, setTargetDate] = useState(project.targetDate ?? '')
  const [blockers, setBlockers] = useState(project.blockers ?? '')

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function openEditModal() {
    // Sincroniza con los valores persistidos por si quedó algo tipeado de una edición
    // cancelada antes: cada apertura arranca desde lo que realmente hay guardado.
    setStatus(fields.status)
    setPriorityOverride(fields.priorityOverride ?? '')
    setNextStep(fields.nextStep ?? '')
    setNotes(fields.notes ?? '')
    setOwnerAlias(project.ownerAlias ?? '')
    setTargetDate(project.targetDate ?? '')
    setBlockers(project.blockers ?? '')
    setError(null)
    setModalOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await updateProjectFields({
          code: project.code,
          status,
          priorityOverride: priorityOverride || null,
          nextStep: nextStep || null,
          notes: notes || null,
          ownerAlias: ownerAlias.trim() || null,
          targetDate: targetDate || null,
          blockers: blockers.trim() || null,
        })
        setModalOpen(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar los cambios')
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">{project.name}</h1>
            {project.isExample && (
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-foreground/60 dark:bg-white/10">
                Proyecto de ejemplo
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={openEditModal}
            className="shrink-0 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Editar proyecto
          </button>
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className={labelClass}>Cliente</dt>
            <dd className="text-foreground">{project.clientAlias}</dd>
          </div>
          <div>
            <dt className={labelClass}>Tipo de trabajo</dt>
            <dd className="text-foreground">{project.engagementType}</dd>
          </div>
          <div>
            <dt className={labelClass}>Estado</dt>
            <dd className="text-foreground">{fields.status}</dd>
          </div>
          <div>
            <dt className={labelClass}>Responsable</dt>
            <dd className="text-foreground">{project.ownerAlias ?? 'sin asignar'}</dd>
          </div>
          <div>
            <dt className={labelClass}>Fecha límite</dt>
            <dd className="text-foreground">{project.targetDate ?? 'sin fecha'}</dd>
          </div>
          <div>
            <dt className={labelClass}>Valor de negocio</dt>
            <dd className="text-foreground">{formatUsd(project.businessValueUsd)}</dd>
          </div>
          <div>
            <dt className={labelClass}>Código</dt>
            <dd className="font-mono text-foreground/70">{project.code}</dd>
          </div>
        </dl>

        {project.summary && (
          <div>
            <p className={labelClass}>Resumen (solo lectura)</p>
            <p className="text-sm text-foreground/80">{project.summary}</p>
          </div>
        )}
      </section>

      {(declaredMismatch.healthVsFlags || declaredMismatch.overdueTasksCount) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          {declaredMismatch.healthVsFlags && (
            <>
              <p className="font-semibold">
                Declarado &quot;{project.declaredHealth ?? 'Sano'}&quot; pero el sistema detecta:
              </p>
              <ul className="mt-1 list-inside list-disc">
                {flags.flatMap((f) => f.reasons).map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </>
          )}
          {declaredMismatch.overdueTasksCount && (
            <p className={declaredMismatch.healthVsFlags ? 'mt-2' : 'font-semibold'}>
              Tareas vencidas: la fuente declaraba {declaredMismatch.overdueTasksCount.declared},
              hoy son {declaredMismatch.overdueTasksCount.real}.
            </p>
          )}
        </div>
      )}

      {issues.length > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-200">
          <p className="font-semibold">Notas de calidad de datos ({issues.length})</p>
          <ul className="mt-1 list-inside list-disc">
            {issues.map((issue) => (
              <li key={issue.id}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Tareas ({tasks.length})</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-foreground/50">Este proyecto no tiene tareas.</p>
        ) : (
          <TaskBoard tasks={tasks} projectCode={project.code} />
        )}
      </section>

      {changeLog.length > 0 && (
        <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Historial de cambios ({changeLog.length})
            </summary>
            <ul className="mt-3 flex flex-col gap-2 text-xs text-foreground/70">
              {changeLog.map((c) => (
                <li key={c.id} className="border-b border-black/5 pb-2 last:border-0 dark:border-white/5">
                  <span className="text-foreground/50">{c.at}</span> · {c.entity} {c.entityCode} ·{' '}
                  <span className="font-medium">{c.field}</span>: {c.oldValue ?? '(vacío)'} →{' '}
                  {c.newValue ?? '(vacío)'}
                  {c.source !== 'ui' && <span className="ml-1 text-foreground/40">({c.source})</span>}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Editar proyecto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Estado</span>
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className={labelClass}>Prioridad</span>
              <select
                className={inputClass}
                value={priorityOverride}
                onChange={(e) => setPriorityOverride(e.target.value)}
              >
                <option value="">Derivada automáticamente</option>
                {PRIORITY_LABELS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className={labelClass}>Responsable</span>
              <input
                className={inputClass}
                value={ownerAlias}
                onChange={(e) => setOwnerAlias(e.target.value)}
                placeholder="Alias del responsable"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className={labelClass}>Fecha límite</span>
              <input
                type="date"
                className={inputClass}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>Siguiente paso</span>
            <textarea
              className={inputClass}
              rows={2}
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="Qué sigue para este proyecto"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>Bloqueos</span>
            <textarea
              className={inputClass}
              rows={2}
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="Qué está bloqueando a este proyecto, si algo lo está"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>Notas</span>
            <textarea
              className={inputClass}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto adicional"
            />
          </label>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserIcon, CalendarIcon, CornerDownRightIcon } from 'lucide-react'
import type { ProjectView } from '@/lib/engine/types'
import type { Task, ImportIssue, ChangeLogEntry } from '@/lib/db/schema'
import { PROJECT_STATUSES, PRIORITY_LABELS, TASK_STATUSES } from '@/lib/config'
import { updateProjectFields, setNextStepFromTask, unblockTask } from '@/lib/actions'
import { cycleTaskCodes } from '@/lib/engine/dependencies'
import { daysOverdue, isOverdue } from '@/lib/clock'
import { displayLabel, formatDate, formatUsd } from '@/lib/format'
import {
  AUTO_PRIORITY,
  AUTO_PRIORITY_LABEL,
  NEUTRAL_CHIP,
  PRIORITY_CHIP,
  TASK_STATUS_ACCENT,
} from '@/lib/ui-tokens'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Field } from '@/components/Field'

export type ProjectDetailFormProps = {
  view: ProjectView
  issues: ImportIssue[]
  changeLog: ChangeLogEntry[]
  /** Fecha de referencia resuelta en el servidor — ver comentario en la página que la pasa. */
  now: string
}

/**
 * Tarjeta de tarea (tablero Kanban) — de solo lectura + las 2 acciones puntuales, con todos
 * los campos de detalle que existen en el dato (rol, de qué depende, detalle). `detail` y
 * `lastProgress` traen exactamente el mismo texto en las 82 filas del dataset, así que se
 * muestra uno solo en vez de duplicar el mismo párrafo dos veces.
 */
function TaskCard({
  task,
  projectCode,
  inCycle,
  now,
}: {
  task: Task
  projectCode: string
  inCycle: boolean
  now: string
}) {
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
  const overdue = isOverdue(task.dueDate, now)
  const lateDays = overdue ? daysOverdue(task.dueDate, now) : 0

  return (
    <Card
      size="sm"
      className={`gap-2.5 p-3 ${inCycle ? 'ring-2 ring-red-300 dark:ring-red-900/60' : 'ring-1'}`}
    >
      <p className="text-sm leading-snug font-medium text-foreground">{task.title}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className={`border-0 ${PRIORITY_CHIP[task.priority] ?? NEUTRAL_CHIP}`}
        >
          {displayLabel(task.priority)}
        </Badge>
        {inCycle && (
          <Badge variant="outline" className="border-0 bg-red-500/15 text-red-700 dark:text-red-300">
            Ciclo de dependencias
          </Badge>
        )}
      </div>

      {/* Metadatos en filas propias con icono, en vez de una sola línea con separadores "·":
          asignado y fecha son los dos datos que se escanean primero y antes competían con la
          prioridad en el mismo párrafo gris. */}
      <dl className="flex flex-col gap-1 text-xs">
        {task.assigneeAlias && (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Asignado a</dt>
            <UserIcon className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
            <dd className="min-w-0 truncate text-foreground/90">
              {task.assigneeAlias}
              {task.assigneeRole && (
                <span className="text-muted-foreground"> · {task.assigneeRole}</span>
              )}
            </dd>
          </div>
        )}

        {task.dueDate && (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Fecha límite</dt>
            <CalendarIcon
              className={`size-3.5 shrink-0 ${overdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground/60'}`}
              aria-hidden
            />
            <dd className={overdue ? 'font-medium text-red-600 dark:text-red-400' : 'text-foreground/90'}>
              {formatDate(task.dueDate)}
              {overdue && (
                <span className="font-normal">
                  {' '}
                  · vencida hace {lateDays} {lateDays === 1 ? 'día' : 'días'}
                </span>
              )}
            </dd>
          </div>
        )}

        {task.dependencyTitle && (
          <div className="flex items-start gap-1.5">
            <CornerDownRightIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
            <dt className="shrink-0 text-muted-foreground">depende de</dt>
            <dd className="min-w-0 text-foreground/90">{task.dependencyTitle}</dd>
          </div>
        )}
      </dl>

      {detail && (
        <p className="border-l-2 pl-2 text-xs leading-relaxed text-muted-foreground">
          {detail}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-0.5">
        {task.status === 'Bloqueada' && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleUnblock}
            disabled={isPending}
          >
            {isPending ? 'Desbloqueando…' : 'Desbloquear'}
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={handleUseAsNextStep} disabled={isPending}>
          {isPending ? 'Guardando…' : 'Usar como siguiente paso'}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {done === 'unblocked' && !error && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Tarea desbloqueada.</p>
      )}
      {done === 'nextstep' && !error && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Siguiente paso del proyecto actualizado.
        </p>
      )}
    </Card>
  )
}

/**
 * Tablero tipo Trello: una columna por estado de tarea (`TASK_STATUSES`, el mismo orden que
 * usa el resto del sistema), cada una con sus tarjetas. Las tareas que participan en un
 * ciclo de dependencias (PRJ-04: T02 <-> T03) se marcan con un badge rojo en su propia
 * tarjeta — el ciclo importa sin importar en qué columna de estado caiga cada una.
 */
function TaskBoard({ tasks, projectCode, now }: { tasks: Task[]; projectCode: string; now: string }) {
  const cyclesSet = useMemo(() => cycleTaskCodes(tasks), [tasks])

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const column = tasks.filter((t) => t.status === status)
        return (
          <Card
            key={status}
            className={`gap-3 border-t-4 bg-muted/30 p-3 ${TASK_STATUS_ACCENT[status] ?? ''}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{displayLabel(status)}</h3>
              <Badge variant="secondary" className="tabular-nums">
                {column.length}
              </Badge>
            </div>
            {column.length === 0 ? (
              <p className="text-xs text-muted-foreground/70">Sin tareas</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {column.map((task) => (
                  <li key={task.code}>
                    <TaskCard
                      task={task}
                      projectCode={projectCode}
                      inCycle={cyclesSet.has(task.code)}
                      now={now}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      })}
    </div>
  )
}

/**
 * Pantalla de detalle de un proyecto. Las tareas son el canvas principal, en un tablero tipo
 * Trello (una columna por estado) visible de entrada — es el contenido operativo. Los 7
 * campos editables del enunciado (estado, prioridad, responsable, fecha límite, siguiente
 * paso, bloqueos, notas) viven en un modal que solo aparece al pulsar "Editar proyecto":
 * edición es una acción puntual, no algo que deba competir por espacio en pantalla con el
 * tablero.
 */
export function ProjectDetailForm({ view, issues, changeLog, now }: ProjectDetailFormProps) {
  const { project, fields, tasks, declaredMismatch, flags } = view
  const router = useRouter()

  const [modalOpen, setModalOpen] = useState(false)
  const [status, setStatus] = useState(fields.status)
  const [priorityOverride, setPriorityOverride] = useState<string>(fields.priorityOverride ?? AUTO_PRIORITY)
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
    setPriorityOverride(fields.priorityOverride ?? AUTO_PRIORITY)
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
          priorityOverride: priorityOverride === AUTO_PRIORITY ? null : priorityOverride,
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
      {/* Cabecera compacta: antes eran 7 campos en 2 columnas sobre 1280px, con la etiqueta
          encima de cada valor — 4 filas de alto y muchísimo ancho vacío para valores de una
          palabra. Ahora la rejilla se densifica hasta 4 columnas y el resumen va bajo el
          título como descripción, sin una etiqueta que gastaba otro renglón. */}
      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">{project.name}</h1>
              {project.isExample && <Badge variant="secondary">Proyecto de ejemplo</Badge>}
            </div>
            {project.summary && (
              <p className="mt-0.5 text-sm text-muted-foreground">{project.summary}</p>
            )}
          </div>
          <Button type="button" onClick={openEditModal} className="shrink-0">
            Editar proyecto
          </Button>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Cliente</dt>
            <dd className="truncate text-foreground">{project.clientAlias}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tipo de trabajo</dt>
            <dd className="truncate text-foreground">{displayLabel(project.engagementType)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Estado</dt>
            <dd className="text-foreground">{fields.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Responsable</dt>
            <dd className="truncate text-foreground">{project.ownerAlias ?? 'sin asignar'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fecha límite</dt>
            <dd className="text-foreground">{formatDate(project.targetDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Valor de negocio</dt>
            <dd className="text-foreground">{formatUsd(project.businessValueUsd)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Código</dt>
            <dd className="font-mono text-muted-foreground">{project.code}</dd>
          </div>
        </dl>
      </Card>

      {(declaredMismatch.healthVsFlags || declaredMismatch.overdueTasksCount) && (
        <Alert className="border-amber-300 bg-amber-50/60 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          {declaredMismatch.healthVsFlags && (
            <>
              <AlertTitle>
                Declarado &quot;{project.declaredHealth ?? 'Sano'}&quot; pero el sistema detecta:
              </AlertTitle>
              <AlertDescription className="text-amber-900/90 dark:text-amber-200/90">
                <ul className="list-inside list-disc">
                  {flags.flatMap((f) => f.reasons).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </AlertDescription>
            </>
          )}
          {declaredMismatch.overdueTasksCount && (
            <AlertTitle className={declaredMismatch.healthVsFlags ? 'mt-2' : ''}>
              Tareas vencidas: la fuente declaraba {declaredMismatch.overdueTasksCount.declared}, hoy son{' '}
              {declaredMismatch.overdueTasksCount.real}.
            </AlertTitle>
          )}
        </Alert>
      )}

      {issues.length > 0 && (
        <Alert className="border-sky-200 bg-sky-50/50 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-200">
          <AlertTitle>Notas de calidad de datos ({issues.length})</AlertTitle>
          <AlertDescription className="text-sky-900/90 dark:text-sky-200/90">
            <ul className="list-inside list-disc">
              {issues.map((issue) => (
                <li key={issue.id}>{issue.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Tareas ({tasks.length})</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este proyecto no tiene tareas.</p>
        ) : (
          <TaskBoard tasks={tasks} projectCode={project.code} now={now} />
        )}
      </section>

      {changeLog.length > 0 && (
        <Card className="p-4">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Historial de cambios ({changeLog.length})
            </summary>
            <ul className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
              {changeLog.map((c) => (
                <li key={c.id} className="border-b pb-2 last:border-0">
                  <span className="text-muted-foreground/70">{formatDate(c.at.slice(0, 10))}</span> ·{' '}
                  {c.entity} {c.entityCode} ·{' '}
                  <span className="font-medium text-foreground">{c.field}</span>: {c.oldValue ?? '(vacío)'} →{' '}
                  {c.newValue ?? '(vacío)'}
                  {c.source !== 'ui' && <span className="ml-1 text-muted-foreground/60">({c.source})</span>}
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar proyecto</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Estado">
                {(id) => (
                  <Select value={status} onValueChange={(v) => setStatus(v ?? '')}>
                    <SelectTrigger id={id} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field label="Prioridad">
                {(id) => (
                  <Select
                    value={priorityOverride}
                    onValueChange={(v) => setPriorityOverride(v ?? AUTO_PRIORITY)}
                  >
                    <SelectTrigger id={id} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTO_PRIORITY}>{AUTO_PRIORITY_LABEL}</SelectItem>
                      {PRIORITY_LABELS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {displayLabel(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field label="Responsable">
                {(id) => (
                  <Input
                    id={id}
                    value={ownerAlias}
                    onChange={(e) => setOwnerAlias(e.target.value)}
                    placeholder="Alias del responsable"
                  />
                )}
              </Field>

              <Field label="Fecha límite">
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                )}
              </Field>
            </div>

            <Field label="Siguiente paso">
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  placeholder="Qué sigue para este proyecto"
                />
              )}
            </Field>

            <Field label="Bloqueos">
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  placeholder="Qué está bloqueando a este proyecto, si algo lo está"
                />
              )}
            </Field>

            <Field label="Notas">
              {(id) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contexto adicional"
                />
              )}
            </Field>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="-mx-4 -mb-4 mt-0">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

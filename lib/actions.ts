'use server'

import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, projects, projectFields, tasks, changeLog } from '@/lib/db'
import { PROJECT_STATUSES, PRIORITY_LABELS, ENGAGEMENT_TYPES } from '@/lib/config'

/**
 * Server actions: son las únicas mutaciones del sistema. Todas registran en `change_log`
 * (entity/field/old/new) porque el estado actual no cuenta la historia — es la brecha que
 * la propia tesis del sistema exige no repetir (ver lib/db/schema.ts).
 *
 * Cada acción que escribe más de una tabla lo hace dentro de `db.transaction(...)`. El driver
 * de better-sqlite3 es síncrono: la función que recibe `transaction()` no puede usar `await`
 * adentro (si lo hiciera, el commit ocurriría antes de que termine el cuerpo async, dejando
 * la transacción sin sentido). Por eso las lecturas van *antes* de abrir la transacción y el
 * bloque transaccional solo hace `.values(...).run()` sin await. Sin esto, `createProject`
 * podía dejar un `projects` sin su `project_fields` si el segundo insert fallaba — y
 * `loadAllViews` asume que todo proyecto tiene fields (`fieldsByCode.get(p.code)!`), así que
 * ese huérfano tumbaba la carga de TODA la consola, no solo la de ese proyecto.
 */

type Tx = Parameters<typeof db.transaction>[0] extends (tx: infer T) => unknown ? T : never

function nowIso() {
  return new Date().toISOString()
}

function logChange(
  tx: Tx,
  entity: 'project' | 'task',
  entityCode: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
) {
  if (oldValue === newValue) return
  tx.insert(changeLog)
    .values({ entity, entityCode, field, oldValue, newValue, at: nowIso(), source: 'ui' })
    .run()
}

export type CreateProjectInput = {
  name: string
  clientAlias: string
  engagementType: string
  ownerAlias?: string
  targetDate?: string | null
  businessValue?: number | null
  status?: string
  priorityOverride?: string | null
  nextStep?: string | null
  notes?: string | null
  blockers?: string | null
}

export async function createProject(input: CreateProjectInput) {
  if (!input.name?.trim()) throw new Error('El proyecto necesita un nombre')
  if (!input.clientAlias?.trim()) throw new Error('El proyecto necesita un cliente')
  if (!ENGAGEMENT_TYPES.includes(input.engagementType as (typeof ENGAGEMENT_TYPES)[number])) {
    throw new Error(`Tipo de trabajo inválido: ${input.engagementType}`)
  }

  const code = `USR-${randomBytes(3).toString('hex').toUpperCase()}`
  const stamp = nowIso()
  const fieldsToLog = {
    status: input.status ?? 'Activo',
    priorityOverride: input.priorityOverride || null,
    nextStep: input.nextStep || null,
    notes: input.notes || null,
  }

  db.transaction((tx) => {
    tx.insert(projects)
      .values({
        code,
        engagementType: input.engagementType,
        clientAlias: input.clientAlias.trim(),
        name: input.name.trim(),
        ownerAlias: input.ownerAlias?.trim() || null,
        targetDate: input.targetDate || null,
        businessValue: input.businessValue ?? null,
        currency: input.businessValue ? 'USD' : null,
        businessValueUsd: input.businessValue ?? null,
        blockers: input.blockers?.trim() || null,
        isExample: false,
        importedAt: stamp,
      })
      .run()

    tx.insert(projectFields)
      .values({ code, ...fieldsToLog, updatedAt: stamp })
      .run()

    for (const [field, value] of Object.entries(fieldsToLog)) {
      if (value) logChange(tx, 'project', code, field, null, String(value))
    }
    if (input.blockers?.trim()) logChange(tx, 'project', code, 'blockers', null, input.blockers.trim())
  })

  revalidatePath('/')
  return { code }
}

export type UpdateProjectFieldsInput = {
  code: string
  status?: string
  priorityOverride?: string | null
  nextStep?: string | null
  notes?: string | null
  ownerAlias?: string | null
  targetDate?: string | null
  blockers?: string | null
}

/**
 * Los 7 campos que el enunciado pide guardar/editar. Cuatro viven en `project_fields`
 * (status, priorityOverride, nextStep, notes — creados por el sistema, sobreviven a una
 * reimportación). Los otros tres (ownerAlias, targetDate, blockers) viven en `projects`
 * — se actualizan en la misma transacción para no dejar las dos tablas inconsistentes.
 *
 * Antes solo se podían editar los 4 primeros: responsable, fecha límite y bloqueos quedaban
 * de solo lectura para siempre, y un proyecto creado desde la UI (sin "fuente" de la cual
 * heredar `blockers`) no tenía ninguna forma de describir por qué estaba bloqueado.
 */
export async function updateProjectFields(input: UpdateProjectFieldsInput) {
  const [current] = await db.select().from(projectFields).where(eq(projectFields.code, input.code))
  if (!current) throw new Error(`Proyecto ${input.code} no existe`)
  const [currentProject] = await db.select().from(projects).where(eq(projects.code, input.code))
  if (!currentProject) throw new Error(`Proyecto ${input.code} no existe`)

  if (input.status && !PROJECT_STATUSES.includes(input.status as (typeof PROJECT_STATUSES)[number])) {
    throw new Error(`Estado inválido: ${input.status}`)
  }
  if (
    input.priorityOverride &&
    !PRIORITY_LABELS.includes(input.priorityOverride as (typeof PRIORITY_LABELS)[number])
  ) {
    throw new Error(`Prioridad inválida: ${input.priorityOverride}`)
  }

  const next = {
    status: input.status ?? current.status,
    priorityOverride: input.priorityOverride === undefined ? current.priorityOverride : input.priorityOverride,
    nextStep: input.nextStep === undefined ? current.nextStep : input.nextStep,
    notes: input.notes === undefined ? current.notes : input.notes,
  }
  const nextProject = {
    ownerAlias: input.ownerAlias === undefined ? currentProject.ownerAlias : input.ownerAlias?.trim() || null,
    targetDate: input.targetDate === undefined ? currentProject.targetDate : input.targetDate || null,
    blockers: input.blockers === undefined ? currentProject.blockers : input.blockers?.trim() || null,
  }

  db.transaction((tx) => {
    logChange(tx, 'project', input.code, 'status', current.status, next.status)
    logChange(tx, 'project', input.code, 'priorityOverride', current.priorityOverride, next.priorityOverride)
    logChange(tx, 'project', input.code, 'nextStep', current.nextStep, next.nextStep)
    logChange(tx, 'project', input.code, 'notes', current.notes, next.notes)
    logChange(tx, 'project', input.code, 'ownerAlias', currentProject.ownerAlias, nextProject.ownerAlias)
    logChange(tx, 'project', input.code, 'targetDate', currentProject.targetDate, nextProject.targetDate)
    logChange(tx, 'project', input.code, 'blockers', currentProject.blockers, nextProject.blockers)

    tx.update(projectFields)
      .set({ ...next, updatedAt: nowIso() })
      .where(eq(projectFields.code, input.code))
      .run()

    tx.update(projects).set(nextProject).where(eq(projects.code, input.code)).run()
  })

  revalidatePath('/')
  revalidatePath(`/proyectos/${input.code}`)
}

/** Acción de tarea 1/2: usar el título de una tarea como siguiente paso del proyecto. */
export async function setNextStepFromTask(projectCode: string, taskCode: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.code, taskCode))
  if (!task || task.projectCode !== projectCode) throw new Error('Tarea no encontrada en este proyecto')

  const [current] = await db.select().from(projectFields).where(eq(projectFields.code, projectCode))

  db.transaction((tx) => {
    logChange(tx, 'project', projectCode, 'nextStep', current?.nextStep ?? null, task.title)
    tx.update(projectFields)
      .set({ nextStep: task.title, updatedAt: nowIso() })
      .where(eq(projectFields.code, projectCode))
      .run()
  })

  revalidatePath('/')
  revalidatePath(`/proyectos/${projectCode}`)
}

/** Acción de tarea 2/2: desbloquear (sale de "Bloqueada" a "Por hacer"). */
export async function unblockTask(taskCode: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.code, taskCode))
  if (!task) throw new Error('Tarea no encontrada')
  if (task.status !== 'Bloqueada') return

  db.transaction((tx) => {
    logChange(tx, 'task', taskCode, 'status', task.status, 'Por hacer')
    tx.update(tasks).set({ status: 'Por hacer' }).where(eq(tasks.code, taskCode)).run()
  })

  revalidatePath('/')
  revalidatePath(`/proyectos/${task.projectCode}`)
}

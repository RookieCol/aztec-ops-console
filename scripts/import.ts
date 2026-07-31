/**
 * Importador del xlsx. Explícito, idempotente y re-ejecutable — no es un seed de un solo tiro.
 *
 *   pnpm db:import                    # importa el dataset del enunciado
 *   SOURCE_XLSX=otro.xlsx pnpm db:import
 *
 * Garantías:
 *  - upsert por código: correrlo dos veces deja la misma base.
 *  - `project_fields` (estado, prioridad, siguiente paso, notas) NO se pisa: es trabajo humano.
 *  - todo lo que se normaliza, falta o se contradice queda en `import_issues`, nunca en un catch vacío.
 */
import ExcelJS from 'exceljs'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  projects,
  projectFields,
  tasks,
  teamDeclared,
  importRuns,
  importIssues,
  changeLog,
} from '@/lib/db/schema'
import { COP_PER_USD, SHEETS, SOURCE_XLSX } from '@/lib/config'
import { today } from '@/lib/clock'
import { formatDate } from '@/lib/format'
import { readSheet } from '@/lib/import/sheet'
import {
  isJunkNotesRow,
  normalizeBool,
  normalizeDate,
  normalizeText,
  normalizeValue,
  type Issue,
} from '@/lib/import/normalize'
import { EXAMPLE_PROJECTS } from './examples'

type PendingIssue = Issue & { sheet: string; rowRef?: string; entityCode?: string }

async function main() {
  const startedAt = new Date().toISOString()
  const stamp = startedAt
  const issues: PendingIssue[] = []
  const note = (i: PendingIssue) => issues.push(i)

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(SOURCE_XLSX)

  const [{ id: runId }] = await db
    .insert(importRuns)
    .values({
      sourceFile: SOURCE_XLSX.split('/').pop() ?? SOURCE_XLSX,
      startedAt,
      appToday: today(),
      fxCopPerUsd: COP_PER_USD,
    })
    .returning({ id: importRuns.id })

  // ---------------------------------------------------------------- Projects
  const wsProjects = wb.getWorksheet(SHEETS.projects)
  if (!wsProjects) throw new Error(`Falta la pestaña ${SHEETS.projects}`)
  const { rows: projectRows } = readSheet(wsProjects)

  const seenProjects: string[] = []
  for (const row of projectRows) {
    if (row.isEmpty()) continue
    const code = normalizeText(row.get('project_code'))
    if (!code) {
      note({
        sheet: SHEETS.projects,
        rowRef: row.ref,
        severity: 'error',
        code: 'project_without_code',
        message: 'Fila de la hoja Projects sin código de proyecto: no se puede identificar, se descarta.',
      })
      continue
    }

    const start = normalizeDate(row.get('start_date'))
    const target = normalizeDate(row.get('target_date'))
    const value = normalizeValue(row.get('business_value'), row.get('currency'))
    for (const i of [...start.issues, ...target.issues, ...value.issues]) {
      note({ ...i, sheet: SHEETS.projects, rowRef: row.ref, entityCode: code })
    }

    if (!target.value) {
      note({
        sheet: SHEETS.projects,
        rowRef: row.ref,
        entityCode: code,
        severity: 'warn',
        code: 'target_date_missing',
        message:
          'La fuente no trae fecha límite para este proyecto, así que no se puede medir su urgencia por fecha: queda en un valor neutro, señalado en la vista.',
      })
    }
    if (start.value && target.value && start.value >= target.value) {
      note({
        sheet: SHEETS.projects,
        rowRef: row.ref,
        entityCode: code,
        severity: 'warn',
        code: 'zero_length_window',
        message: `El proyecto arranca el ${formatDate(start.value)} y vence el ${formatDate(target.value)}: no queda ningún día para ejecutarlo.`,
      })
    }

    await db
      .insert(projects)
      .values({
        code,
        engagementType: normalizeText(row.get('engagement_type')) ?? 'Proyecto',
        clientAlias: normalizeText(row.get('client_alias')) ?? 'Sin cliente',
        name: normalizeText(row.get('project_name')) ?? code,
        projectTypeApi: normalizeText(row.get('project_type_api')),
        stage: normalizeText(row.get('stage')),
        ownerAlias: normalizeText(row.get('owner_alias')),
        ownerRole: normalizeText(row.get('owner_role')),
        declaredStatus: normalizeText(row.get('status')),
        declaredHealth: normalizeText(row.get('health')),
        declaredOpenTasks: Number(normalizeText(row.get('open_tasks')) ?? 0),
        declaredOverdueTasks: Number(normalizeText(row.get('overdue_tasks')) ?? 0),
        startDate: start.value,
        targetDate: target.value,
        businessValue: value.value.value,
        currency: value.value.currency,
        businessValueUsd: value.value.usd,
        blockers: normalizeText(row.get('blockers')),
        summary: normalizeText(row.get('summary')),
        recentCompletedExamples: normalizeText(row.get('recent_completed_examples')),
        isExample: false,
        sourceRow: row.rowNumber,
        importedAt: stamp,
      })
      .onConflictDoUpdate({
        target: projects.code,
        set: {
          engagementType: sql`excluded.engagement_type`,
          clientAlias: sql`excluded.client_alias`,
          name: sql`excluded.name`,
          projectTypeApi: sql`excluded.project_type_api`,
          stage: sql`excluded.stage`,
          ownerAlias: sql`excluded.owner_alias`,
          ownerRole: sql`excluded.owner_role`,
          declaredStatus: sql`excluded.declared_status`,
          declaredHealth: sql`excluded.declared_health`,
          declaredOpenTasks: sql`excluded.declared_open_tasks`,
          declaredOverdueTasks: sql`excluded.declared_overdue_tasks`,
          startDate: sql`excluded.start_date`,
          targetDate: sql`excluded.target_date`,
          businessValue: sql`excluded.business_value`,
          currency: sql`excluded.currency`,
          businessValueUsd: sql`excluded.business_value_usd`,
          blockers: sql`excluded.blockers`,
          summary: sql`excluded.summary`,
          recentCompletedExamples: sql`excluded.recent_completed_examples`,
          sourceRow: sql`excluded.source_row`,
          importedAt: sql`excluded.imported_at`,
        },
      })

    // Los campos del sistema se crean vacíos una sola vez y no se vuelven a tocar nunca.
    await db
      .insert(projectFields)
      .values({ code, status: 'Activo', updatedAt: stamp })
      .onConflictDoNothing()

    seenProjects.push(code)
  }

  // Duplicados probables: mismo cliente y nombre casi idéntico. No se fusionan, se señalan.
  const all = await db.select().from(projects)
  const byClient = new Map<string, { code: string; name: string }[]>()
  for (const p of all) {
    if (p.isExample) continue
    const key = p.clientAlias
    const base = p.name.replace(/\s*\(.*?\)\s*$/, '').trim().toLowerCase()
    const list = byClient.get(key) ?? []
    const twin = list.find((x) => x.name === base)
    if (twin) {
      note({
        sheet: SHEETS.projects,
        entityCode: p.code,
        severity: 'warn',
        code: 'possible_duplicate',
        message: `Posible duplicado de ${twin.code}: mismo cliente y nombre base "${base}". Requiere decisión humana; no se fusiona.`,
      })
    }
    list.push({ code: p.code, name: base })
    byClient.set(key, list)
  }

  const gone = all.filter((p) => !p.isExample && !seenProjects.includes(p.code))
  for (const p of gone) {
    note({
      sheet: SHEETS.projects,
      entityCode: p.code,
      severity: 'warn',
      code: 'absent_in_source',
      message:
        'Este proyecto venía en una importación anterior y ya no aparece en la fuente. No se borra: se conserva por si la ausencia fue un error del archivo.',
    })
  }

  // ------------------------------------------------------------------- Tasks
  const wsTasks = wb.getWorksheet(SHEETS.tasks)
  if (!wsTasks) throw new Error(`Falta la pestaña ${SHEETS.tasks}`)
  const { rows: taskRows } = readSheet(wsTasks)

  type Staged = {
    code: string
    projectCode: string
    dependencyTitle: string | null
    titleBase: string
    values: typeof tasks.$inferInsert
  }
  const staged: Staged[] = []

  for (const row of taskRows) {
    if (row.isEmpty()) continue
    const code = normalizeText(row.get('task_code'))
    const projectCode = normalizeText(row.get('project_code'))
    if (!code || !projectCode) {
      note({
        sheet: SHEETS.tasks,
        rowRef: row.ref,
        severity: 'error',
        code: 'task_without_keys',
        message: 'Fila de la hoja Tasks sin código de tarea o de proyecto: no se puede vincular, se descarta.',
      })
      continue
    }
    if (!seenProjects.includes(projectCode)) {
      note({
        sheet: SHEETS.tasks,
        rowRef: row.ref,
        entityCode: code,
        severity: 'error',
        code: 'orphan_task',
        message: `Esta tarea dice pertenecer al proyecto ${projectCode}, que no existe en la hoja Projects.`,
      })
    }

    const due = normalizeDate(row.get('due_date'))
    for (const i of due.issues) {
      note({ ...i, sheet: SHEETS.tasks, rowRef: row.ref, entityCode: code })
    }

    const declaredOverdue = normalizeBool(row.get('is_overdue'))
    // La contradicción central del dataset, registrada fila por fila.
    //
    // El mensaje enuncia un hecho invariante (la fecha de entrega y lo que la fuente afirma
    // sobre ella) en vez de una comparación contra "hoy". Se guarda en la base al importar:
    // si dijera "y contra 2026-08-01 es Si", una semana después seguiría mostrando esa fecha
    // como si fuera hoy. Así el texto sigue siendo cierto cuando se lea.
    if (due.value && declaredOverdue !== null) {
      const reallyOverdue = due.value < today()
      if (reallyOverdue !== declaredOverdue) {
        note({
          sheet: SHEETS.tasks,
          rowRef: row.ref,
          entityCode: code,
          severity: 'info',
          code: 'declared_overdue_mismatch',
          message: declaredOverdue
            ? `La fuente marca esta tarea como vencida, pero su fecha de entrega es el ${formatDate(due.value)}.`
            : `Esta tarea venció el ${formatDate(due.value)}, pero la fuente la marca como al día.`,
        })
      }
    }

    const title = normalizeText(row.get('title')) ?? code
    staged.push({
      code,
      projectCode,
      dependencyTitle: normalizeText(row.get('dependency')),
      titleBase: title.split(' - ')[0].trim(),
      values: {
        code,
        projectCode,
        engagementType: normalizeText(row.get('engagement_type')),
        assigneeAlias: normalizeText(row.get('assignee_alias')),
        assigneeRole: normalizeText(row.get('assignee_role')),
        priority: normalizeText(row.get('priority')) ?? 'Media',
        status: normalizeText(row.get('status')) ?? 'Por hacer',
        dueDate: due.value,
        declaredIsOverdue: declaredOverdue,
        dependencyTitle: normalizeText(row.get('dependency')),
        dependencyCode: null,
        title,
        detail: normalizeText(row.get('detail')),
        lastProgress: normalizeText(row.get('last_progress')),
        sourceRow: row.rowNumber,
        importedAt: stamp,
      },
    })
  }

  // Las dependencias vienen por título, no por código: se resuelven dentro del proyecto.
  const byProjectTitle = new Map<string, string>()
  for (const s of staged) byProjectTitle.set(`${s.projectCode}::${s.titleBase}`, s.code)
  for (const s of staged) {
    if (!s.dependencyTitle) continue
    const target = byProjectTitle.get(`${s.projectCode}::${s.dependencyTitle.trim()}`)
    if (!target) {
      note({
        sheet: SHEETS.tasks,
        entityCode: s.code,
        severity: 'warn',
        code: 'dependency_unresolved',
        message: `Depende de una tarea llamada "${s.dependencyTitle}", que no existe en este proyecto: la dependencia queda sin vincular.`,
        rawValue: s.dependencyTitle,
      })
      continue
    }
    s.values.dependencyCode = target
  }

  for (const s of staged) {
    await db
      .insert(tasks)
      .values(s.values)
      .onConflictDoUpdate({
        target: tasks.code,
        set: {
          projectCode: sql`excluded.project_code`,
          engagementType: sql`excluded.engagement_type`,
          assigneeAlias: sql`excluded.assignee_alias`,
          assigneeRole: sql`excluded.assignee_role`,
          priority: sql`excluded.priority`,
          status: sql`excluded.status`,
          dueDate: sql`excluded.due_date`,
          declaredIsOverdue: sql`excluded.declared_is_overdue`,
          dependencyTitle: sql`excluded.dependency_title`,
          dependencyCode: sql`excluded.dependency_code`,
          title: sql`excluded.title`,
          detail: sql`excluded.detail`,
          lastProgress: sql`excluded.last_progress`,
          sourceRow: sql`excluded.source_row`,
          importedAt: sql`excluded.imported_at`,
        },
      })
  }

  // Conteos declarados a nivel proyecto contra el recálculo.
  for (const p of all) {
    if (p.isExample) continue
    const mine = staged.filter((s) => s.projectCode === p.code)
    const overdueNow = mine.filter((s) => s.values.dueDate && s.values.dueDate < today()).length
    if ((p.declaredOverdueTasks ?? 0) !== overdueNow) {
      note({
        sheet: SHEETS.projects,
        entityCode: p.code,
        severity: 'info',
        code: 'declared_overdue_count_mismatch',
        // Acá el conteo sí es una foto del momento de importar (depende de qué día era),
        // así que el mensaje lo dice en vez de hacerlo pasar por un dato vigente.
        message: `La fuente declara ${p.declaredOverdueTasks} ${p.declaredOverdueTasks === 1 ? 'tarea vencida' : 'tareas vencidas'}; al importar (${formatDate(today())}) ${overdueNow === 1 ? 'era' : 'eran'} ${overdueNow}.`,
      })
    }
    if ((p.declaredOpenTasks ?? 0) !== mine.length) {
      note({
        sheet: SHEETS.projects,
        entityCode: p.code,
        severity: 'info',
        code: 'declared_open_count_mismatch',
        message: `La fuente declara ${p.declaredOpenTasks} ${p.declaredOpenTasks === 1 ? 'tarea abierta' : 'tareas abiertas'}, pero la hoja Tasks trae ${mine.length}.`,
      })
    }
  }

  // -------------------------------------------------------------------- Team
  const wsTeam = wb.getWorksheet(SHEETS.team)
  let teamCount = 0
  if (wsTeam) {
    const { rows } = readSheet(wsTeam)
    for (const row of rows) {
      if (row.isEmpty()) continue
      const alias = normalizeText(row.get('member_alias'))
      if (!alias) continue
      const num = (c: string) => Number(normalizeText(row.get(c)) ?? 0)
      await db
        .insert(teamDeclared)
        .values({
          memberAlias: alias,
          role: normalizeText(row.get('role')),
          projectsInPortfolio: num('projects_in_portfolio'),
          openTasksAssigned: num('open_tasks_assigned'),
          blockedTasksAssigned: num('blocked_tasks_assigned'),
          highOrCriticalOpen: num('high_or_critical_open'),
          diagnosticoProjects: num('diagnostico_projects'),
          proyectoProjects: num('proyecto_projects'),
          mantenimientoProjects: num('mantenimiento_projects'),
          importedAt: stamp,
        })
        .onConflictDoUpdate({
          target: teamDeclared.memberAlias,
          set: {
            role: sql`excluded.role`,
            projectsInPortfolio: sql`excluded.projects_in_portfolio`,
            openTasksAssigned: sql`excluded.open_tasks_assigned`,
            blockedTasksAssigned: sql`excluded.blocked_tasks_assigned`,
            highOrCriticalOpen: sql`excluded.high_or_critical_open`,
            diagnosticoProjects: sql`excluded.diagnostico_projects`,
            proyectoProjects: sql`excluded.proyecto_projects`,
            mantenimientoProjects: sql`excluded.mantenimiento_projects`,
            importedAt: sql`excluded.imported_at`,
          },
        })
      teamCount++
    }

    // La pestaña Team omite miembros que sí tienen trabajo asignado.
    const declared = new Set((await db.select().from(teamDeclared)).map((t) => t.memberAlias))
    const assignees = new Set(staged.map((s) => s.values.assigneeAlias).filter(Boolean) as string[])
    for (const a of assignees) {
      if (!declared.has(a)) {
        note({
          sheet: SHEETS.team,
          entityCode: a,
          severity: 'warn',
          code: 'member_missing_in_team',
          message: `${a} tiene tareas asignadas pero no figura en la pestaña Team, así que la carga del equipo se calcula desde las tareas y no desde esa hoja.`,
        })
      }
    }
  }

  // ------------------------------------------------------------------- Notas
  const wsNotes = wb.getWorksheet(SHEETS.notes)
  if (wsNotes) {
    // Notas no tiene fila de cabecera: se recorre cruda, incluida la fila 1.
    let junk = 0
    wsNotes.eachRow((row) => {
      const cells = (row.values as unknown[]).slice(1)
      if (isJunkNotesRow(cells[0], cells[1])) junk++
    })
    if (junk > 0) {
      note({
        sheet: SHEETS.notes,
        severity: 'info',
        code: 'junk_rows_skipped',
        message: `Se descartaron ${junk} filas de prueba de la pestaña Notas (contenido tipo "test / ok", sin datos reales).`,
      })
    }
  }

  // ---------------------------------------------------------------- Ejemplos
  // El enunciado pide ejemplos con distintos estados y prioridades. El dataset trae
  // status "Activo" en 22/22 y ninguna prioridad de proyecto, así que se agregan acá para
  // que quien clone el repo los vea sin tener que mirar el video.
  let examples = 0
  for (const ex of EXAMPLE_PROJECTS) {
    await db
      .insert(projects)
      .values({ ...ex.project, isExample: true, importedAt: stamp })
      .onConflictDoUpdate({
        target: projects.code,
        set: { importedAt: sql`excluded.imported_at` },
      })
    await db
      .insert(projectFields)
      .values({ ...ex.fields, code: ex.project.code, updatedAt: stamp })
      .onConflictDoNothing()
    for (const [field, value] of Object.entries(ex.fields)) {
      if (field === 'code' || value == null) continue
      await db.insert(changeLog).values({
        entity: 'project',
        entityCode: ex.project.code,
        field,
        oldValue: null,
        newValue: String(value),
        at: stamp,
        source: 'seed',
      })
    }
    examples++
  }

  // ------------------------------------------------------------------ Cierre
  await db.delete(importIssues).where(eq(importIssues.runId, runId))
  if (issues.length) {
    await db.insert(importIssues).values(
      issues.map((i) => ({
        runId,
        sheet: i.sheet,
        rowRef: i.rowRef ?? null,
        entityCode: i.entityCode ?? null,
        severity: i.severity,
        code: i.code,
        message: i.message,
        rawValue: i.rawValue ?? null,
      })),
    )
  }

  await db
    .update(importRuns)
    .set({
      finishedAt: new Date().toISOString(),
      projectsCount: seenProjects.length,
      tasksCount: staged.length,
      teamCount,
      issuesCount: issues.length,
    })
    .where(eq(importRuns.id, runId))

  const bySeverity = issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.severity] = (acc[i.severity] ?? 0) + 1
    return acc
  }, {})
  const byCode = issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.code] = (acc[i.code] ?? 0) + 1
    return acc
  }, {})

  const assignees = new Set(staged.map((s) => s.values.assigneeAlias).filter(Boolean))

  console.log(`\nImportación #${runId} — fuente: ${SOURCE_XLSX.split('/').pop()}`)
  console.log(`  hoy = ${today()}  ·  tasa COP/USD = ${COP_PER_USD}`)
  console.log(`  proyectos ${seenProjects.length}  tareas ${staged.length}  team declarado ${teamCount}`)
  console.log(`  personas con tareas: ${assignees.size}  ·  ejemplos del sistema: ${examples}`)
  console.log(`  issues de calidad: ${issues.length}`, bySeverity)
  for (const [code, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(3)}  ${code}`)
  }

  const errors = issues.filter((i) => i.severity === 'error')
  if (errors.length) {
    console.error(`\n${errors.length} errores duros:`)
    for (const e of errors.slice(0, 10)) console.error(`  ${e.rowRef ?? e.entityCode}: ${e.message}`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

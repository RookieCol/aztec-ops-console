import { eq } from 'drizzle-orm'
import { db, projects, projectFields, tasks, teamDeclared, importIssues, importRuns, changeLog } from '@/lib/db'
import { buildProjectView, groupByEngagementType, topBySeverity } from '@/lib/engine/project-view'
import { computeWorkload } from '@/lib/engine/workload'
import { compareForRanking } from '@/lib/engine/score'
import { today } from '@/lib/clock'
import type { ProjectView } from '@/lib/engine/types'

/**
 * Punto único de lectura para la UI (Server Components). Carga todo, calcula en memoria
 * (22 proyectos, nada que optimizar) y no persiste ningún derivado — ver lib/engine.
 */
export async function loadAllViews(now = today()): Promise<ProjectView[]> {
  const [allProjects, allFields, allTasks] = await Promise.all([
    db.select().from(projects),
    db.select().from(projectFields),
    db.select().from(tasks),
  ])

  const fieldsByCode = new Map(allFields.map((f) => [f.code, f]))
  const tasksByProject = new Map<string, typeof allTasks>()
  for (const t of allTasks) {
    const list = tasksByProject.get(t.projectCode) ?? []
    list.push(t)
    tasksByProject.set(t.projectCode, list)
  }

  return allProjects
    .map((p) => {
      let fields = fieldsByCode.get(p.code)
      if (!fields) {
        // No debería pasar — createProject/el importador escriben projects y project_fields
        // en la misma transacción — pero si algún dato quedó huérfano (p.ej. una corrida
        // vieja antes de que existiera la transacción), un proyecto sin fields no puede
        // tumbar la carga de TODOS los demás. Se sustituye por defaults visibles y se
        // registra en el log del servidor para que no pase inadvertido.
        console.error(`project_fields faltante para ${p.code}: usando defaults`)
        fields = { code: p.code, status: 'Activo', priorityOverride: null, nextStep: null, notes: null, updatedAt: now }
      }
      return buildProjectView(p, fields, tasksByProject.get(p.code) ?? [], now)
    })
    .sort((a, b) => compareForRanking(a, b))
}

export async function loadProjectView(code: string, now = today()): Promise<ProjectView | null> {
  const [project] = await db.select().from(projects).where(eq(projects.code, code))
  if (!project) return null
  let [fields] = await db.select().from(projectFields).where(eq(projectFields.code, code))
  if (!fields) {
    console.error(`project_fields faltante para ${code}: usando defaults`)
    fields = { code, status: 'Activo', priorityOverride: null, nextStep: null, notes: null, updatedAt: now }
  }
  const projectTasks = await db.select().from(tasks).where(eq(tasks.projectCode, code))
  return buildProjectView(project, fields, projectTasks, now)
}

/**
 * Hallazgos de calidad e historial de edición de ESTE proyecto (y sus tareas — un código de
 * tarea es siempre `${projectCode}-T0N`). Antes esto solo existía agregado en el panel
 * global de la home: para ver "PRJ-22 es posible duplicado de PRJ-08" había que ir al home,
 * expandir el panel y buscar entre 64 filas. `change_log` tenía el mismo problema al revés:
 * se escribe en cada mutación pero no existía ninguna pantalla que lo mostrara — el sistema
 * resolvía "el estado actual no cuenta la historia" en la base y no lo dejaba ver.
 */
export async function loadProjectExtras(code: string) {
  const prefix = `${code}-`
  const belongsToProject = (entityCode: string | null) =>
    entityCode === code || (entityCode?.startsWith(prefix) ?? false)

  const [allIssues, allChanges] = await Promise.all([
    db.select().from(importIssues),
    db.select().from(changeLog),
  ])

  return {
    issues: allIssues.filter((i) => belongsToProject(i.entityCode)),
    changeLog: allChanges
      .filter((c) => belongsToProject(c.entityCode))
      .sort((a, b) => b.at.localeCompare(a.at)),
  }
}

export async function loadWorkload(now = today()) {
  const [allTasks, team] = await Promise.all([db.select().from(tasks), db.select().from(teamDeclared)])
  return computeWorkload(allTasks, new Set(team.map((t) => t.memberAlias)), now)
}

export async function loadImportSummary() {
  const [runs, issues] = await Promise.all([
    db.select().from(importRuns).orderBy(importRuns.id),
    db.select().from(importIssues),
  ])
  const lastRun = runs.at(-1) ?? null
  return { lastRun, issues }
}

export async function loadDashboard(now = today()) {
  const views = await loadAllViews(now)
  const workload = await loadWorkload(now)
  const { lastRun, issues } = await loadImportSummary()

  return {
    views,
    workload,
    lastRun,
    issues,
    groups: groupByEngagementType(views),
    // Sin límite (antes top-3): la franja lista todos los proyectos de cada flag, ordenados
    // por severidad, con scroll propio por columna (AlertStrip) para que quien tenga 18 en
    // riesgo pueda verlos todos sin que la tarjeta empuje el resto de la pantalla.
    alerts: {
      bloqueado: topBySeverity(views, 'bloqueado', Infinity),
      en_riesgo: topBySeverity(views, 'en_riesgo', Infinity),
      sin_siguiente_paso: topBySeverity(views, 'sin_siguiente_paso', Infinity),
    },
    now,
  }
}

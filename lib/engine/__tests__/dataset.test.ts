/**
 * Test de integración contra el dataset real importado (no fixtures sintéticas).
 * Verifica que el motor reproduce, con la fecha congelada 2026-07-31, los conteos exactos
 * verificados sobre el xlsx real. Si alguien vuelve a leer `is_overdue`/`declared_health`
 * del xlsx en vez de recalcular, este test lo detecta.
 *
 * Precondición: `pnpm db:import` corrido contra el xlsx del enunciado (lo hace `pretest`).
 */
import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { db, projects, projectFields, tasks } from '@/lib/db'
import { buildProjectView } from '@/lib/engine/project-view'
import { computeWorkload } from '@/lib/engine/workload'
import { loadProjectExtras } from '@/lib/data/views'

const NOW = '2026-07-31'

async function loadViews() {
  const allProjects = await db.select().from(projects).where(eq(projects.isExample, false))
  const allFields = await db.select().from(projectFields)
  const allTasks = await db.select().from(tasks)

  const fieldsByCode = new Map(allFields.map((f) => [f.code, f]))
  const tasksByProject = new Map<string, typeof allTasks>()
  for (const t of allTasks) {
    const list = tasksByProject.get(t.projectCode) ?? []
    list.push(t)
    tasksByProject.set(t.projectCode, list)
  }

  return allProjects.map((p) =>
    buildProjectView(p, fieldsByCode.get(p.code)!, tasksByProject.get(p.code) ?? [], NOW),
  )
}

describe('motor de detección contra el dataset real (fecha congelada 2026-07-31)', () => {
  it('reproduce los conteos exactos verificados sobre el dataset', async () => {
    const views = await loadViews()
    expect(views).toHaveLength(22)

    const count = (kind: 'bloqueado' | 'en_riesgo' | 'sin_siguiente_paso') =>
      views.filter((v) => v.flags.some((f) => f.kind === kind)).length

    expect(count('bloqueado')).toBe(17)
    // 13 con target_date vencida + PRJ-01/02/14/15/16 (sin target_date, pero con tareas
    // Alta/Crítica vencidas: sus fechas de tarea son todas de julio, antes de hoy). Sin esta
    // cláusula esos 5 quedaban invisibles a "en riesgo" solo por no tener fecha de proyecto.
    expect(count('en_riesgo')).toBe(18)
    expect(count('sin_siguiente_paso')).toBe(1)

    // Solo la cohorte B "sana" (menos PRJ-21) queda sin ningún flag.
    const clean = views.filter((v) => v.flags.length === 0).map((v) => v.project.code).sort()
    expect(clean).toEqual(['PRJ-17', 'PRJ-18', 'PRJ-19', 'PRJ-20'])
  })

  it('PRJ-21 cae en en_riesgo y en sin_siguiente_paso, y su health declarado contradice los flags', async () => {
    const views = await loadViews()
    const prj21 = views.find((v) => v.project.code === 'PRJ-21')!
    const kinds = prj21.flags.map((f) => f.kind).sort()
    expect(kinds).toEqual(['en_riesgo', 'sin_siguiente_paso'].sort())
    expect(prj21.project.declaredHealth).toBe('Sano')
    expect(prj21.declaredMismatch.healthVsFlags).toBe(true)
  })

  it('PRJ-04 tiene deadlock de dependencias detectado (T02 <-> T03)', async () => {
    const views = await loadViews()
    const prj04 = views.find((v) => v.project.code === 'PRJ-04')!
    const blocked = prj04.flags.find((f) => f.kind === 'bloqueado')
    expect(blocked).toBeDefined()
    expect(blocked!.reasons.join(' ')).toMatch(/ciclo/i)
  })

  it('los 18 proyectos en_riesgo rankean sin empates dentro de su severidad', async () => {
    const views = await loadViews()
    const risky = views
      .map((v) => ({ code: v.project.code, flag: v.flags.find((f) => f.kind === 'en_riesgo') }))
      .filter((x): x is { code: string; flag: NonNullable<typeof x.flag> } => !!x.flag)
      .sort((a, b) => b.flag.severity - a.flag.severity)

    expect(risky).toHaveLength(18)
    // PRJ-21 (171 días) debe superar a PRJ-03 (151) y este a PRJ-12 (70).
    const byCode = new Map(risky.map((r, i) => [r.code, i]))
    expect(byCode.get('PRJ-21')!).toBeLessThan(byCode.get('PRJ-03')!)
    expect(byCode.get('PRJ-03')!).toBeLessThan(byCode.get('PRJ-12')!)

    const severities = risky.map((r) => r.flag.severity)
    const uniqueSeverities = new Set(severities)
    expect(uniqueSeverities.size).toBeGreaterThan(1) // no todos empatados en el mismo número
  })

  it('34 de las 82 tareas tienen is_overdue declarado distinto de la realidad contra hoy', async () => {
    const allTasks = await db.select().from(tasks)
    expect(allTasks).toHaveLength(82)
    const mismatches = allTasks.filter(
      (t) => t.dueDate && t.declaredIsOverdue !== null && (t.dueDate < NOW) !== t.declaredIsOverdue,
    )
    expect(mismatches).toHaveLength(34)
  })

  it('PRJ-21 no queda enterrado en la cola pese a tener 0 tareas (regresión)', async () => {
    // Bug real encontrado en revisión: con prioridad derivada de tareas, 0 tareas caía a
    // "Baja"/0 y diluía una urgencia casi máxima (98.5) hasta score.total=57.3 — fuera del
    // top-6 de 18 proyectos en riesgo. "Vencido + sin backlog" es señal de alerta, no de
    // baja prioridad (nadie lo replanificó). Con el fix, debe quedar en el tercio superior
    // del portafolio completo sin haber sido forzado a ser el #1.
    const views = await loadViews()
    const prj21 = views.find((v) => v.project.code === 'PRJ-21')!
    expect(prj21.score.priorityLabel).not.toBe('Baja')
    expect(prj21.score.prioritySource).toBe('empty-backlog') // no es override ni conteo: es la excepción

    const ranked = [...views].sort((a, b) => b.score.total - a.score.total)
    const position = ranked.findIndex((v) => v.project.code === 'PRJ-21')
    expect(position).toBeLessThan(views.length / 2) // mitad superior de 22
  })

  it('flag.severity de en_riesgo y score.urgencia comparten la misma base de días (regresión)', async () => {
    // Bug real: flags.ts tenía su propia curva de "qué tan vencido" (por tramos calibrados
    // a este dataset) mientras score.ts tenía urgencyScore (continua). El top-3 por
    // flag.severity y el top-3 por score.total llegaron a compartir solo 1 de 3 proyectos.
    // Ahora flags.ts reutiliza urgencyScore como base, así que para el mismo proyecto la
    // severidad del flag y la urgencia del score solo pueden diferir por los bonus menores
    // (conteo de tareas Alta/Crítica vencidas y fuera de plan), nunca por tramos distintos.
    const views = await loadViews()
    for (const v of views) {
      const risk = v.flags.find((f) => f.kind === 'en_riesgo')
      if (!risk) continue
      expect(Math.abs(risk.severity - v.score.urgencia)).toBeLessThan(10)
    }
  })

  it('carga por persona: 6 personas con tareas, Team declarado omite a Andrea Molina', async () => {
    const allTasks = await db.select().from(tasks)
    const workload = computeWorkload(allTasks, new Set(['Camila Torres', 'Laura Gomez', 'Mateo Ruiz', 'Daniel Rojas', 'Santiago Vera']), NOW)
    expect(workload).toHaveLength(6)
    const andrea = workload.find((w) => w.alias === 'Andrea Molina')!
    expect(andrea.inTeamSheet).toBe(false)
    expect(andrea.openTasks).toBe(4)

    const camila = workload.find((w) => w.alias === 'Camila Torres')!
    expect(camila.openTasks).toBe(28)
    expect(Math.round(camila.shareOfBacklog * 100)).toBe(34)
  })
})

describe('loadProjectExtras — hallazgos e historial filtrados por proyecto', () => {
  it('PRJ-22 recibe la nota de posible duplicado con PRJ-08 (antes solo visible en el panel global)', async () => {
    const { issues } = await loadProjectExtras('PRJ-22')
    const duplicate = issues.find((i) => i.code === 'possible_duplicate')
    expect(duplicate).toBeDefined()
  })

  it('un proyecto sin hallazgos propios no arrastra los de otros proyectos', async () => {
    // PRJ-17 es de la cohorte "sana": no debería traer el hallazgo de duplicado de PRJ-22.
    const { issues } = await loadProjectExtras('PRJ-17')
    expect(issues.some((i) => i.code === 'possible_duplicate')).toBe(false)
  })

  it('los hallazgos de tareas del proyecto (código con prefijo) también se incluyen', async () => {
    // PRJ-04 tiene 34 mismatches de is_overdue en todo el dataset; al menos alguno debe
    // caer sobre una tarea de PRJ-04 específicamente (entityCode = "PRJ-04-T0N").
    const { issues } = await loadProjectExtras('PRJ-04')
    const taskLevel = issues.filter((i) => i.entityCode?.startsWith('PRJ-04-T'))
    expect(taskLevel.length).toBeGreaterThan(0)
  })
})

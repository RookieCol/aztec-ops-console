/**
 * Verificación del estado de la base tras la importación. Imprime los números que el plan
 * declara como criterio de aceptación del bloque H1, para no tener que creerle al importador.
 */
import { db } from '@/lib/db'
import { projects, projectFields, tasks, teamDeclared, importRuns, importIssues } from '@/lib/db/schema'
import { today } from '@/lib/clock'

async function main() {
  const p = await db.select().from(projects)
  const t = await db.select().from(tasks)
  const f = await db.select().from(projectFields)
  const runs = await db.select().from(importRuns)
  const issues = await db.select().from(importIssues)
  const team = await db.select().from(teamDeclared)

  const real = p.filter((x) => !x.isExample)
  const examples = p.filter((x) => x.isExample)
  const assignees = new Set(t.map((x) => x.assigneeAlias).filter(Boolean))
  const owners = new Set(p.map((x) => x.ownerAlias).filter(Boolean))
  const overdueTargets = real.filter((x) => x.targetDate && x.targetDate < today())
  const noTarget = real.filter((x) => !x.targetDate)
  const withDeps = t.filter((x) => x.dependencyCode)
  const unresolvedDeps = t.filter((x) => x.dependencyTitle && !x.dependencyCode)
  const declaredWrong = t.filter(
    (x) => x.dueDate && x.declaredIsOverdue !== null && x.dueDate < today() !== x.declaredIsOverdue,
  )

  console.log(`\nEstado de la base — hoy = ${today()}`)
  console.log(`  importaciones corridas: ${runs.length}`)
  console.log(`  proyectos: ${p.length} (${real.length} del dataset + ${examples.length} ejemplos)`)
  console.log(`  tareas: ${t.length}`)
  console.log(`  project_fields: ${f.length}`)
  console.log(`  team declarado: ${team.length}  ·  personas con tareas: ${assignees.size}  ·  responsables: ${owners.size}`)
  console.log(`  issues de calidad registrados: ${issues.length}`)

  console.log(`\nHechos que el motor de detección va a usar (H2):`)
  console.log(`  target_date vencida: ${overdueTargets.length} proyectos`)
  console.log(`  sin target_date: ${noTarget.length} (${noTarget.map((x) => x.code).join(', ')})`)
  console.log(`  tareas bloqueadas: ${t.filter((x) => x.status === 'Bloqueada').length}`)
  console.log(`  tareas en progreso: ${t.filter((x) => x.status === 'En progreso').length}`)
  console.log(`  dependencias resueltas: ${withDeps.length}  ·  sin resolver: ${unresolvedDeps.length}`)
  console.log(`  is_overdue declarado != realidad: ${declaredWrong.length} de ${t.length} tareas`)

  console.log(`\nNormalizaciones:`)
  const prj17 = real.find((x) => x.code === 'PRJ-17')
  console.log(`  PRJ-17.start_date = ${prj17?.startDate} (venía "02/03/2026")`)
  for (const c of real.filter((x) => x.currency === 'COP')) {
    console.log(`  ${c.code}: ${c.businessValue?.toLocaleString('es-CO')} COP → ${Math.round(c.businessValueUsd ?? 0).toLocaleString('en-US')} USD`)
  }
  console.log(`  sin valor: ${real.filter((x) => x.businessValueUsd === null).map((x) => x.code).join(', ') || 'ninguno'}`)

  console.log(`\nEjemplos del sistema (estados y prioridades distintos):`)
  for (const e of examples) {
    const fields = f.find((x) => x.code === e.code)
    console.log(`  ${e.code}  ${fields?.status?.padEnd(9)} prioridad=${fields?.priorityOverride ?? 'derivada'}  ${e.engagementType}  target=${e.targetDate}  next_step=${fields?.nextStep ? 'si' : 'no'}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

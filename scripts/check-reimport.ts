/**
 * Prueba de reimportación: edita a mano, reimporta y comprueba que el trabajo humano sobrevive.
 * Es el criterio que separa un seed de un importador. Se corre con: pnpm tsx scripts/check-reimport.ts
 */
import { eq, sql } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { db } from '@/lib/db'
import { projectFields, projects, tasks, importRuns, importIssues } from '@/lib/db/schema'

const HUMAN = {
  status: 'En pausa',
  nextStep: 'EDICION HUMANA: llamar al cliente',
  notes: 'nota del operador',
}

async function counts() {
  const n = async (t: SQLiteTable) =>
    Number((await db.select({ n: sql<number>`count(*)` }).from(t))[0].n)
  return {
    proyectos: await n(projects),
    tareas: await n(tasks),
    campos: await n(projectFields),
    corridas: await n(importRuns),
    issues: await n(importIssues),
  }
}

async function main() {
  const arg = process.argv[2]

  if (arg === 'edit') {
    await db
      .update(projectFields)
      .set({ ...HUMAN, updatedAt: new Date().toISOString() })
      .where(eq(projectFields.code, 'PRJ-21'))
    console.log('PRJ-21 editado a mano:', HUMAN)
    console.log('antes de reimportar:', await counts())
    return
  }

  const f = (await db.select().from(projectFields).where(eq(projectFields.code, 'PRJ-21')))[0]
  const survived =
    f.status === HUMAN.status && f.nextStep === HUMAN.nextStep && f.notes === HUMAN.notes
  console.log('PRJ-21 después de reimportar:', {
    status: f.status,
    nextStep: f.nextStep,
    notes: f.notes,
  })
  console.log('conteos:', await counts())
  console.log(survived ? '\nOK: la edición humana sobrevivió la reimportación' : '\nFALLA: se pisó la edición humana')
  if (!survived) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

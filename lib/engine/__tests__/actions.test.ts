/**
 * Bug real encontrado en revisión: createProject hacía dos inserts sueltos (projects,
 * project_fields) sin transacción. Si el segundo fallaba, quedaba un proyecto huérfano sin
 * fields — y lib/data/views.ts asumía que todo proyecto tiene fields, así que un huérfano
 * tumbaba la carga de TODA la consola, no solo la de ese proyecto. Ahora createProject
 * escribe ambas tablas en una sola transacción (lib/actions.ts).
 *
 * Este test verifica la propiedad observable: tras crear un proyecto, ambas filas existen
 * en la misma foto de la base — no reproduce el fallo a mitad de camino (eso requeriría
 * inyectar una falla en el driver), pero confirma que el camino feliz deja el invariante
 * que el resto del sistema asume.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { db, projects, projectFields } from '@/lib/db'
import { createProject, updateProjectFields } from '@/lib/actions'

// revalidatePath solo funciona dentro de un request de Next.js real; fuera de ese contexto
// (como en este test) lanza "static generation store missing". Se mockea porque lo que este
// test verifica es la escritura en la base, no el cacheo de rutas de Next.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const createdCodes: string[] = []

afterEach(async () => {
  for (const code of createdCodes.splice(0)) {
    await db.delete(projectFields).where(eq(projectFields.code, code))
    await db.delete(projects).where(eq(projects.code, code))
  }
})

describe('createProject', () => {
  it('deja projects y project_fields consistentes tras crear (invariante que asume loadAllViews)', async () => {
    const { code } = await createProject({
      name: 'Proyecto de test',
      clientAlias: 'Cliente de test',
      engagementType: 'Proyecto',
    })
    createdCodes.push(code)

    const [project] = await db.select().from(projects).where(eq(projects.code, code))
    const [fields] = await db.select().from(projectFields).where(eq(projectFields.code, code))

    expect(project).toBeDefined()
    expect(fields).toBeDefined()
    expect(fields.status).toBe('Activo')
  })

  it('rechaza un tipo de trabajo inválido antes de escribir nada', async () => {
    await expect(
      createProject({ name: 'x', clientAlias: 'y', engagementType: 'Inventado' }),
    ).rejects.toThrow(/Tipo de trabajo inválido/)
  })
})

describe('updateProjectFields — responsable, fecha límite y bloqueos (bug real: antes solo lectura)', () => {
  it('permite fijar blockers al crear, y editar responsable/fecha límite/bloqueos después', async () => {
    // Antes de este fix: un proyecto creado desde la UI no tenía forma de fijar `blockers`
    // nunca (no estaba en CreateProjectInput), y ownerAlias/targetDate quedaban congelados
    // en lo que se puso al crear — el enunciado pide poder "actualizar" los 7 campos.
    const { code } = await createProject({
      name: 'Proyecto de test con bloqueos',
      clientAlias: 'Cliente de test',
      engagementType: 'Proyecto',
      ownerAlias: 'Persona A',
      targetDate: '2026-09-01',
      blockers: 'Esperando aprobación legal',
    })
    createdCodes.push(code)

    const [created] = await db.select().from(projects).where(eq(projects.code, code))
    expect(created.ownerAlias).toBe('Persona A')
    expect(created.targetDate).toBe('2026-09-01')
    expect(created.blockers).toBe('Esperando aprobación legal')

    await updateProjectFields({
      code,
      ownerAlias: 'Persona B',
      targetDate: '2026-10-15',
      blockers: 'Ya no hay bloqueo, se resolvió',
    })

    const [updated] = await db.select().from(projects).where(eq(projects.code, code))
    expect(updated.ownerAlias).toBe('Persona B')
    expect(updated.targetDate).toBe('2026-10-15')
    expect(updated.blockers).toBe('Ya no hay bloqueo, se resolvió')
  })

  it('omitir un campo en el update no lo borra (undefined = sin cambios, no null)', async () => {
    const { code } = await createProject({
      name: 'Proyecto de test parcial',
      clientAlias: 'Cliente de test',
      engagementType: 'Proyecto',
      ownerAlias: 'Persona A',
      blockers: 'Bloqueo original',
    })
    createdCodes.push(code)

    await updateProjectFields({ code, status: 'En pausa' }) // no toca ownerAlias/blockers

    const [row] = await db.select().from(projects).where(eq(projects.code, code))
    expect(row.ownerAlias).toBe('Persona A')
    expect(row.blockers).toBe('Bloqueo original')
  })
})

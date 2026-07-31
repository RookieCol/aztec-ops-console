import type { projects, projectFields } from '@/lib/db/schema'

type ProjectInsert = Omit<typeof projects.$inferInsert, 'importedAt' | 'isExample'>
type FieldsInsert = Omit<typeof projectFields.$inferInsert, 'code' | 'updatedAt'>

/**
 * Ejemplos del sistema — no vienen del xlsx.
 *
 * El enunciado pide entregar "ejemplos de proyectos con distintos estados y prioridades", y el
 * dataset trae `status` = "Activo" en 22 de 22 filas y ninguna prioridad de proyecto. Sin estos,
 * ese entregable solo existiría en el video. Van marcados con `is_example` para que quede claro
 * qué es dato de la operación y qué es demostración.
 *
 * Uno por cola, para que se vea que las tres colas no compiten entre sí.
 */
export const EXAMPLE_PROJECTS: { project: ProjectInsert; fields: FieldsInsert }[] = [
  {
    // Estado "En pausa" con prioridad forzada a Baja: no debería subir aunque tenga fecha.
    project: {
      code: 'DEMO-01',
      engagementType: 'Proyecto',
      clientAlias: 'Ejemplo · Solaris Retail',
      name: 'Portal de proveedores (en pausa por el cliente)',
      projectTypeApi: 'Consultoria',
      stage: 'Ejecucion',
      ownerAlias: 'Andrea Molina',
      ownerRole: 'Delivery',
      declaredStatus: null,
      declaredHealth: null,
      declaredOpenTasks: 0,
      declaredOverdueTasks: 0,
      startDate: '2026-06-15',
      targetDate: '2026-10-30',
      businessValue: 12000,
      currency: 'USD',
      businessValueUsd: 12000,
      blockers: null,
      summary: 'Ejemplo del sistema: proyecto pausado a pedido del cliente hasta nuevo aviso.',
      recentCompletedExamples: null,
      sourceRow: null,
    },
    fields: {
      status: 'En pausa',
      priorityOverride: 'Baja',
      nextStep: 'Retomar cuando el cliente confirme presupuesto de Q4',
      notes: 'Pausa acordada por escrito el 2026-07-20. No consume capacidad del equipo.',
    },
  },
  {
    // Cerrado con fecha límite vencida: el sistema no debe alarmarse por lo que ya terminó.
    project: {
      code: 'DEMO-02',
      engagementType: 'Mantenimiento o recurrente',
      clientAlias: 'Ejemplo · Astera Ops',
      name: 'Migración de alertas legacy (cerrada)',
      projectTypeApi: 'Automatizacion',
      stage: 'Ejecucion',
      ownerAlias: 'Daniel Rojas',
      ownerRole: 'Commercial / Delivery',
      declaredStatus: null,
      declaredHealth: null,
      declaredOpenTasks: 0,
      declaredOverdueTasks: 0,
      startDate: '2026-04-01',
      targetDate: '2026-06-30',
      businessValue: 6000,
      currency: 'USD',
      businessValueUsd: 6000,
      blockers: null,
      summary: 'Ejemplo del sistema: cerrado con fecha vencida, para ver que no genera alerta.',
      recentCompletedExamples: null,
      sourceRow: null,
    },
    fields: {
      status: 'Cerrado',
      priorityOverride: 'Media',
      nextStep: null,
      notes: 'Entregado y aceptado el 2026-06-28. Se conserva para histórico.',
    },
  },
  {
    // Activo, crítico, a pocos días y sin siguiente paso: el caso que debe encabezar su cola.
    project: {
      code: 'DEMO-03',
      engagementType: 'Diagnostico',
      clientAlias: 'Ejemplo · Nordway Foods',
      name: 'Diagnóstico de facturación (recién abierto)',
      projectTypeApi: 'Consultoria',
      stage: 'Descubrimiento',
      ownerAlias: 'Santiago Vera',
      ownerRole: 'Delivery',
      declaredStatus: null,
      declaredHealth: null,
      declaredOpenTasks: 0,
      declaredOverdueTasks: 0,
      startDate: '2026-07-28',
      targetDate: '2026-08-05',
      businessValue: 9000,
      currency: 'USD',
      businessValueUsd: 9000,
      blockers: null,
      summary:
        'Ejemplo del sistema: crítico, a días de la fecha y sin siguiente paso definido todavía.',
      recentCompletedExamples: null,
      sourceRow: null,
    },
    fields: {
      status: 'Activo',
      priorityOverride: 'Critica',
      nextStep: null,
      notes: 'Kick off pendiente de agendar.',
    },
  },
]

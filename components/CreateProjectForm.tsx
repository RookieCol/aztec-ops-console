'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PROJECT_STATUSES, PRIORITY_LABELS, ENGAGEMENT_TYPES } from '@/lib/config'
import { createProject } from '@/lib/actions'

export type CreateProjectFormProps = Record<string, never>

const inputClass =
  'w-full rounded-md border border-black/15 bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10 dark:border-white/15'

const labelClass = 'text-xs font-medium text-foreground/60'

/**
 * Formulario de creación de un proyecto nuevo. Los 7 campos que el enunciado pide guardar
 * (responsable, estado, prioridad, fecha límite, siguiente paso, bloqueos, notas) se piden
 * desde el inicio, para no obligar a un segundo paso de edición inmediatamente después de
 * crear. `blockers` en particular tiene que poder fijarse acá: un proyecto nuevo no tiene
 * ninguna "fuente" de la cual heredarlo más adelante.
 */
export function CreateProjectForm() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [clientAlias, setClientAlias] = useState('')
  const [engagementType, setEngagementType] = useState<string>(ENGAGEMENT_TYPES[0])
  const [ownerAlias, setOwnerAlias] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [businessValue, setBusinessValue] = useState('')
  const [status, setStatus] = useState<string>('Activo')
  const [priorityOverride, setPriorityOverride] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [notes, setNotes] = useState('')
  const [blockers, setBlockers] = useState('')

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsedValue = businessValue.trim() ? Number(businessValue) : null
    if (parsedValue !== null && Number.isNaN(parsedValue)) {
      setError('El valor de negocio debe ser un número')
      return
    }

    startTransition(async () => {
      try {
        const { code } = await createProject({
          name,
          clientAlias,
          engagementType,
          ownerAlias: ownerAlias.trim() || undefined,
          targetDate: targetDate || null,
          businessValue: parsedValue,
          status,
          priorityOverride: priorityOverride || null,
          nextStep: nextStep || null,
          notes: notes || null,
          blockers: blockers || null,
        })
        router.push(`/proyectos/${code}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al crear el proyecto')
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-2xl flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10"
    >
      <h1 className="text-lg font-semibold tracking-tight text-foreground">Nuevo proyecto</h1>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Nombre *</span>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del proyecto"
          required
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Cliente *</span>
        <input
          className={inputClass}
          value={clientAlias}
          onChange={(e) => setClientAlias(e.target.value)}
          placeholder="Alias del cliente"
          required
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Tipo de trabajo *</span>
          <select
            className={inputClass}
            value={engagementType}
            onChange={(e) => setEngagementType(e.target.value)}
          >
            {ENGAGEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
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

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Valor de negocio (USD)</span>
          <input
            type="number"
            min="0"
            step="1"
            className={inputClass}
            value={businessValue}
            onChange={(e) => setBusinessValue(e.target.value)}
            placeholder="Ej. 50000"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Estado inicial</span>
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
          <span className={labelClass}>Prioridad inicial</span>
          <select
            className={inputClass}
            value={priorityOverride}
            onChange={(e) => setPriorityOverride(e.target.value)}
          >
            <option value="">Sin fijar (derivada automáticamente)</option>
            {PRIORITY_LABELS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
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
        <span className={labelClass}>Notas</span>
        <textarea
          className={inputClass}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contexto adicional"
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

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Creando…' : 'Crear proyecto'}
        </button>
      </div>
    </form>
  )
}

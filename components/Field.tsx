'use client'

import { useId, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'

/**
 * Campo de formulario con su etiqueta correctamente asociada.
 *
 * `components/ui/label.tsx` renderiza un `<label>` plano: sin `htmlFor` no queda vinculado a
 * nada. Los 18 campos de los dos formularios estaban así — hacer click en "Responsable" no
 * enfocaba el input, y un lector de pantalla anunciaba los campos sin nombre.
 *
 * Se resuelve con render-prop en vez de clonar hijos: el `id` se genera una vez acá y el
 * campo lo recibe explícitamente, sin magia sobre el árbol de React. De paso absorbe el
 * `<div className="flex flex-col gap-1.5">` que se repetía en cada campo.
 */
export function Field({
  label,
  children,
}: {
  label: string
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
    </div>
  )
}

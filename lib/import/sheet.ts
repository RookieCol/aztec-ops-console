import type { Worksheet } from 'exceljs'
import { normalizeText } from './normalize'

export type SheetRow = {
  rowNumber: number
  ref: string
  get(column: string): unknown
  isEmpty(): boolean
}

/**
 * Lee una hoja como filas con acceso por nombre de columna. La cabecera es la fila 1.
 * Si una columna esperada no existe, `get` devuelve undefined en vez de reventar: el
 * importador registra el faltante como issue y sigue.
 */
export function readSheet(ws: Worksheet): { headers: string[]; rows: SheetRow[] } {
  const headerCells = ws.getRow(1).values as unknown[]
  const headers: string[] = []
  const index = new Map<string, number>()

  headerCells.forEach((cell, i) => {
    const name = normalizeText(cell)
    if (!name) return
    headers.push(name)
    index.set(name, i)
  })

  const rows: SheetRow[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const get = (column: string) => {
      const i = index.get(column)
      return i === undefined ? undefined : row.getCell(i).value
    }
    rows.push({
      rowNumber,
      ref: `${ws.name}!${rowNumber}`,
      get,
      isEmpty: () => headers.every((h) => normalizeText(get(h)) === null),
    })
  })

  return { headers, rows }
}

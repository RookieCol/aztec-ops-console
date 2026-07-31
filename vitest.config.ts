import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    // Todos los archivos de test comparten un único SQLite (data/aztec.db) — es a propósito:
    // dataset.test.ts necesita leer el dataset REAL importado, no uno sintético. Pero eso
    // significa que si vitest corre los archivos en paralelo (su comportamiento por
    // defecto), actions.test.ts puede insertar un proyecto real a mitad de una corrida
    // mientras dataset.test.ts cuenta filas al mismo tiempo — una carrera real que se
    // manifestó como "esperaba 22 proyectos, encontró 23". Correr los archivos en serie
    // la elimina; con esta cantidad de tests (<50) el costo es un test run casi imperceptible.
    fileParallelism: false,
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})

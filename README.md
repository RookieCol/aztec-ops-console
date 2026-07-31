# Aztec Ops Console

Consola de seguimiento y priorización para un portafolio con muchos proyectos activos a la vez.
Responde una sola pregunta: **¿qué atiendo hoy, en qué orden y por qué?**

---

## Arrancar

Requisitos: **Node 22+** y [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm db:reset   # crea la base SQLite y la puebla desde el archivo de origen
pnpm dev        # → http://localhost:3000
```

> [!IMPORTANT]
> Detené el servidor antes de correr `pnpm db:reset` (Ctrl+C).
> SQLite en modo WAL no tolera que le borren el archivo con una conexión abierta.

<details>
<summary><b>Otros comandos y variables de entorno</b></summary>

<br>

| Comando | Qué hace |
|---|---|
| `pnpm test` | Motor de detección y score (46 tests). Reimporta la base antes, solo. |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint |
| `pnpm db:import` | Reimporta sin borrar la base (idempotente) |
| `pnpm tsx scripts/verify.ts` | Vuelca el estado de la base tras importar |

Para comprobar que una reimportación **no pisa el trabajo humano** — la garantía que separa a
un importador de un seed — hay que correr los tres pasos en orden:

```bash
pnpm tsx scripts/check-reimport.ts edit   # simula una edición manual
pnpm db:import                            # reimporta encima
pnpm tsx scripts/check-reimport.ts        # → "OK: la edición humana sobrevivió"
```

Ninguna variable es obligatoria; todas tienen un default razonable.

| Variable | Para qué |
|---|---|
| `APP_TODAY` | Congela la fecha contra la que se calcula el riesgo (`YYYY-MM-DD`). Sin ella usa la fecha real, así la detección no envejece. |
| `DB_PATH` | Ruta del SQLite. Default: `data/aztec.db` |
| `SOURCE_XLSX` | Archivo de origen a importar. Default: el incluido en el repo |

</details>

---

## El problema

Con muchos frentes abiertos, la pregunta del día no es *"¿cómo va cada proyecto?"* sino
*"¿qué necesito atender ahora?"*. Eso pide dos cosas que rara vez conviven:

- un criterio de priorización **que se pueda explicar en una frase**;
- una detección de riesgo **que no dependa de que alguien actualice un campo a mano**.

### La decisión de diseño que ordena todo lo demás

**Los campos declarados por el origen no se toman como verdad.**

Cualquier sistema que ingiera datos de otra fuente —un CRM, un export periódico— termina con
campos que quedaron viejos o que se contradicen entre sí. Así que la consola:

| | |
|---|---|
| **Recalcula** | riesgo, bloqueo y urgencia contra la fecha de hoy, en cada lectura |
| **No persiste** | ningún valor derivado: si se guardara, volvería a envejecer |
| **Muestra** | la discrepancia cuando lo declarado y lo real no coinciden, en vez de taparla |

Ejemplo real del dataset incluido: un proyecto declarado **"Sano"** que en realidad lleva
**más de 170 días vencido** y no tiene ni una sola tarea abierta.

La auditoría completa del archivo de origen —con las cifras contadas que sostienen cada regla
del motor— está en **[`docs/analisis-de-datos.md`](docs/analisis-de-datos.md)**.

---

## Qué hace

| | |
|---|---|
| 🔥 **Detecta riesgo con severidad graduada** | Bloqueado · en riesgo · sin siguiente paso, cada uno de 0 a 100 en vez de sí/no. Lo binario no ordena: si media cartera está en rojo, el conteo no dice por dónde empezar. |
| 📊 **Prioriza a la vista** | Cada proyecto tiene un score desglosado y expandible. Sin caja negra. |
| 🗂️ **Separa tipos de trabajo** | Proyecto, diagnóstico y mantenimiento tienen colas propias: no compiten por el mismo orden. |
| 👥 **Calcula la carga real** | Por persona, desde las tareas asignadas — no desde un reporte de capacidad que puede estar viejo. |
| 📋 **Tablero por proyecto** | Tareas por estado, con responsable, dependencias y prioridad. Dos acciones puntuales: desbloquear y fijar como siguiente paso. |
| 🕐 **Historial de cambios** | Cada edición queda registrada, no solo el valor final. |
| 🔎 **Notas de calidad de datos** | Qué se normalizó y qué se contradice, por proyecto y global. Nada se corrige en silencio. |

---

## Criterio de priorización

```
score = 0.5 · urgencia  +  0.3 · prioridad  +  0.2 · flags
```

**Urgencia** — curva continua sobre los días de atraso, no escalones.
<sub>Con escalones, todo lo "muy vencido" empata y se pierde el orden dentro del grupo.</sub>

**Prioridad** — conteo ponderado de tareas abiertas por nivel, con override manual.
<sub>Un proyecto vencido y sin tareas no es de baja prioridad: es uno que nadie replanificó.</sub>

**Flags** — bloqueado o sin siguiente paso suman puntos, además de marcarse.

**Desempate** — mayor valor de negocio conocido.
<sub>Un valor desconocido nunca cuenta como cero: eso lo pondría antes que uno de valor real bajo.</sub>

> Los pesos son una decisión de diseño, no una verdad matemática. Lo que importa es que están
> definidos, se ven al expandir cada proyecto, y se cambian sin tocar el resto del sistema.

---

## Cómo está armado

```
lib/engine/     ← motor puro: detección, score, dependencias, carga (46 tests)
lib/import/     ← normalización del archivo de origen
lib/data/       ← única puerta de lectura para la UI
lib/actions.ts  ← únicas escrituras, en transacción y con bitácora
app/            ← 3 rutas: consola, detalle de proyecto, alta
```

**Stack:** Next.js (App Router) · TypeScript · SQLite vía Drizzle · Tailwind + shadcn/ui.

`lib/engine/` no depende del framework ni de la base: son funciones puras a las que se les
inyecta la fecha, por eso se pueden testear sin levantar nada.

<details>
<summary><b>Datos incluidos</b></summary>

<br>

El repo trae el archivo de origen con **22 proyectos**, **82 tareas** y **6 personas**.
Al importarlo, el sistema levanta **64 notas de calidad de datos** y detecta 17 proyectos
bloqueados, 18 en riesgo y 2 sin siguiente paso.

Como el origen trae poca variedad de estados, se agregan **3 proyectos de ejemplo** para poder
evaluar el sistema desde el primer arranque: uno en pausa con prioridad baja, uno cerrado con
fecha vencida (para confirmar que *no* dispara alertas) y uno crítico sin siguiente paso.

</details>

---

## Qué quedó fuera, a propósito

| Decisión | Por qué |
|---|---|
| **Sin IA en el producto** | La señal de los datos es estructural (fechas, estados, dependencias). No hay texto lo bastante variado como para que un resumen automático aporte algo que la estructura no muestre ya. |
| **Tareas de solo lectura**, salvo dos acciones | El proyecto es la unidad sobre la que se decide; la tarea es la evidencia que alimenta esa decisión. |
| **Sin auth, sin deploy, sin tiempo real** | Corre local con SQLite. Alcanza para un prototipo, no para producción. |
| **Sin edición del equipo** | La carga se calcula, no se administra. |

---

<sub>Uso interno. Todos los derechos reservados.</sub>

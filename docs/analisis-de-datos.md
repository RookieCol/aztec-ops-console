# Auditoría del archivo de origen

Análisis de las 4 pestañas del xlsx que alimenta la consola. Todo lo de acá está contado, no
estimado. Fecha de referencia del análisis: **2026-07-31**.

Volumen: **22 proyectos**, **82 tareas**, **6 personas** (la pestaña Team lista 5).

Este documento es la evidencia detrás de la decisión de diseño central del sistema: *los campos
declarados por el origen no se toman como verdad*. Cada cifra que la consola muestra sale de
recalcular, no de leer lo declarado, y las razones están abajo.

---

## 1. El archivo son dos cohortes pegadas

No es un portafolio homogéneo: son dos lotes con estructura distinta unidos en un mismo export,
y se distinguen por el idioma de los títulos de tarea.

| | Cohorte A | Cohorte B |
|---|---|---|
| Proyectos | 17 (PRJ-01…16, PRJ-22) | 5 (PRJ-17…21) |
| Títulos de tarea | inglés | español |
| `blockers` | siempre lleno | siempre vacío |
| `health` | Bloqueado (13) / En riesgo (4) | Sano (5) |
| Tareas bloqueadas | 1 por proyecto, siempre | ninguna |
| `target_date` | Feb–May 2026 → **toda vencida** | Ago–Oct 2026 → futura, salvo PRJ-21 |
| Vencimientos de tarea | 8–18 jul 2026 | 14 ago–2 sep 2026 |

**Implicación de diseño:** toda la señal de riesgo vive en la cohorte A y es idéntica proyecto a
proyecto. Cualquier regla que se calibre sobre "el portafolio" en realidad se calibra sobre 17
copias del mismo caso. El motor implementado (`lib/engine/flags.ts`, verificado en
`lib/engine/__tests__/dataset.test.ts`) marca **bloqueado 17/22, en riesgo 18/22, sin siguiente
paso 1/22** — con solapamiento, **18 de 22 tienen algún flag** y solo la cohorte B menos PRJ-21
(PRJ-17…20) queda limpia. No es que el portafolio esté en crisis: es que las filas de la cohorte
A siguen un patrón de plantilla que repite la misma crisis en cada una. La severidad graduada
(días de atraso, conteos) es lo único que vuelve a separar las filas dentro de ese 18.

**PRJ-21 es el caso límite del archivo:** cohorte B, declarado "Sano", **0 tareas**,
`target_date` 2026-02-10 → **171 días vencido**. Es el único proyecto donde los campos
declarados y la realidad se contradicen de frente, y el único que no tiene backlog del cual
inferir un siguiente paso.

## 2. Los campos declarados no son cálculos, son literales de plantilla

`is_overdue` no es función de la fecha. Ocho tareas vencen el **mismo día, 2026-07-11**, y
cuatro dicen `Si` y cuatro dicen `No`:

| Tareas | Vence | is_overdue | Patrón que comparten |
|---|---|---|---|
| PRJ-02/03/05/06-T02 | 2026-07-11 | **Si** | Mantenimiento, "Por hacer" |
| PRJ-13/14/15/16-T01 | 2026-07-11 | **No** | Diagnóstico, "En progreso" |

El resto de las fechas parte en 2026-07-12/14, así que el snapshot implícito del archivo es
~13 de julio de 2026. Contra hoy, **34 de las 82 tareas tienen `is_overdue` mal**, y
`overdue_tasks` a nivel proyecto subcuenta en los 17 proyectos de la cohorte A (declara 1–2
donde hoy hay 4).

Esto es más fuerte que "los datos están viejos": el flag **nunca fue un cálculo**. No hay forma
de arreglarlo revisándolo; hay que recalcularlo. Es la justificación completa de la tesis del
sistema.

## 3. Doce proyectos tienen un plan internamente incoherente

En **12 proyectos** (PRJ-03…13 y PRJ-22), **las 4 tareas vencen después de la fecha límite del
proyecto**. PRJ-03 cierra el 2026-03-02 y su última tarea vence el 2026-07-18 — cuatro meses y
medio después del deadline.

No es solo atraso: el proyecto no puede cumplir su fecha ni siquiera según su propio backlog. Es
una detección de riesgo distinta y más barata de defender que la de "vencido", porque no depende
de la fecha de hoy.

## 4. PRJ-04 tiene un ciclo de dependencias

Las dependencias se declaran por **título**, no por código (61 tareas las tienen, todas
resolubles por título dentro de su proyecto). Al construir el grafo aparece un ciclo:

- `PRJ-04-T02` (Resolve priority issue, Crítica) depende de → `PRJ-04-T03` (Align external dependency)
- `PRJ-04-T03` depende de → `PRJ-04-T02`

Ninguna de las dos puede empezar. El proyecto está en deadlock por su propia definición, y
ningún campo del archivo lo dice. Es el mejor ejemplo de "sin siguiente paso claro" que hay en
los datos: **detectar el ciclo es una función pura de 15 líneas** y muestra algo que ni el
`health` declarado ni los `blockers` alcanzan a ver.

## 5. El texto libre no tiene información

- **Los 82 títulos son únicos, pero la unicidad es artificial.** Cada uno es `<arquetipo> -
  <nombre del proyecto>`, y solo hay **16 arquetipos** (4 por tipo de trabajo). El sufijo repite
  `project_name`, que la fila ya trae en su propia columna. Información real de la columna: 16
  valores.
- **`detail` == `last_progress` en 82 de 82 filas.** El campo "último avance" es una copia del
  detalle: cero señal de progreso real.
- **4 valores distintos de `blockers`** para 22 proyectos, y el texto es genérico ("There are
  external dependencies or pending accesses…").
- 18 `summary` distintos, de los cuales 12 son boilerplate ("Proyecto creado via API", "Proyecto
  sincronizado desde la plataforma de desarrollo (XXX)").

**Implicación:** nada de NLP, resúmenes ni clasificación por texto. Toda la señal aprovechable es
estructural — fechas, estados, prioridades, conteos y el grafo de dependencias. Es también la
razón concreta para no meter IA en el producto: no hay texto sobre el cual valga la pena
aplicarla.

## 6. La pestaña Team es exacta, pero está incompleta

Los conteos de Team **coinciden exactamente** con el recálculo desde Tasks (tareas abiertas,
bloqueadas, Alta/Crítica y proyectos como responsable). No están viejos.

El defecto es otro: **Andrea Molina no aparece**. Tiene 4 tareas y es responsable de PRJ-19. La
suma de `open_tasks_assigned` de Team da **78**, y las tareas reales son **82** — faltan justo
sus 4.

| Persona | Tareas | Bloqueadas | Alta/Crítica | Proyectos | Vencidas hoy |
|---|---|---|---|---|---|
| Camila Torres | 28 | 7 | 20 | 7 | 28 |
| Laura Gomez | 19 | 4 | 11 | 5 | 16 |
| Mateo Ruiz | 16 | 3 | 10 | 4 | 12 |
| Daniel Rojas | 11 | 2 | 6 | 3 | 8 |
| Andrea Molina | 4 | 0 | 1 | 1 | 0 | ← ausente de Team |
| Santiago Vera | 4 | 1 | 3 | 2 | 4 |

El cuello de botella real: Camila tiene **34% del backlog**, **6 de las 13 tareas críticas**,
**7 de sus 28 tareas bloqueadas**, y **las 28 vencidas contra hoy**. Y es responsable de 6 de los
12 proyectos de tipo "Proyecto". La carga se calcula desde Tasks por completitud, no porque Team
esté mal.

## 7. Estructura y contradicciones menores

- **`status` tiene un solo valor** ("Activo", 22/22) y **no existe prioridad de proyecto**, ni
  `next_step`, ni `notes`. Esos campos los tiene que crear el sistema.
- **PRJ-08 vs PRJ-22**: idénticos campo a campo salvo `project_code`, el sufijo "(Fase 2)" en el
  nombre y el valor (35.000 vs 38.000 USD). Mismo cliente, mismo responsable, misma fecha límite,
  mismos ejemplos completados. Es un caso real de fases duplicadas — decidir si se relacionan o
  se fusionan es una pregunta de producto, no un bug.
- **PRJ-03**: `start_date` == `target_date` (2026-03-02) → proyecto con ventana de cero días.
- **`PRJ-17.start_date`** llega como `02/03/2026` (dd/mm en texto) mientras el resto es ISO.
- **Faltantes**: 9 proyectos sin `start_date`, 5 sin `target_date` (PRJ-01, 02, 14, 15, 16), 1
  sin valor (PRJ-07).
- **Dos monedas**: 20 en USD, 2 en COP (PRJ-18 85M, PRJ-20 120M). Portafolio ≈ **USD 358k** a
  tasa 4.000.
- **`engagement_type` vs `project_type_api`** son ejes independientes
  (Consultoría/Automatización cruza los tres tipos), y `stage` es redundante con
  `engagement_type`: Diagnóstico ⇔ Descubrimiento, todo lo demás ⇔ Ejecución. Basta un eje para
  las colas.
- **Concentración de cliente**: Orion Mobility tiene 4 proyectos (3 de ellos diagnósticos
  abiertos a la vez); Astera Ops, Nova Recovery y Vector Partners tienen 2 cada uno.
- **Ruido en Notas**: filas `test | ok` y `x | y` antes del contenido real.
- **`recent_completed_examples`** usa códigos de otro sistema (TUE-24, GRQ-20, SUE-1, QUI-10…)
  que no cruzan con ningún `task_code`. No se pueden vincular: se muestran como texto.
- Los 4 objetos de dibujo embebidos en el xlsx están vacíos; no hay contenido oculto ni
  comentarios.

## 8. Qué columna sostiene qué, y cuál no sostiene nada

Inventario de las 45 columnas del archivo contra su uso real en el código. Cinco clases:

| Clase | Qué significa |
|---|---|
| **Núcleo** | El motor decide con ella. Si falta o miente, el orden cambia. |
| **Contraste** | Se importa **solo** para compararla con lo recalculado y mostrar la discrepancia. Nunca decide. |
| **Editable** | El sistema la vuelve suya: el humano la edita y sobrevive a la reimportación. |
| **Contexto** | Se muestra, no se usa para decidir. |
| **Inerte** | Ni se decide ni se muestra. Se importa por fidelidad al origen. |

### Projects — 19 columnas

| Columna | Clase | Por qué |
|---|---|---|
| `project_code` | Núcleo | Clave primaria de todo el modelo |
| `target_date` | **Núcleo** | La columna más cara del archivo: 18 lecturas. Urgencia, riesgo, incoherencia de plan |
| `engagement_type` | Núcleo | Separa las tres colas — trabajos distintos no compiten por el mismo orden |
| `business_value` + `currency` | Núcleo | Desempate; `currency` dispara la conversión COP→USD |
| `owner_alias` | Editable | Uno de los 7 campos |
| `blockers` | Editable + señal | Alimenta el flag de bloqueo y el humano lo edita |
| `health` | **Contraste** | Es lo que el sistema existe para desmentir (PRJ-21 "Sano" a 171 días) |
| `open_tasks`, `overdue_tasks` | **Contraste** | Subcuentan en los 17 proyectos de la cohorte A |
| `status` | **Reemplazada** | Un solo valor, "Activo", en 22 de 22. No es un estado: es una constante. El sistema crea el suyo |
| `client_alias`, `project_name` | Contexto | Identificación en la UI |
| `summary` | Contexto | 12 de 18 son boilerplate; se muestra, no decide |
| `start_date` | Casi inerte | Un solo uso: detectar ventana de cero días (PRJ-03) |
| `project_type_api` | **Inerte** | Eje redundante: Consultoría/Automatización cruza los tres `engagement_type` |
| `stage` | **Inerte** | Determinada por `engagement_type`: Diagnóstico ⇔ Descubrimiento, resto ⇔ Ejecución |
| `owner_role` | **Inerte** | 2 valores para 22 proyectos; se deriva del alias |
| `recent_completed_examples` | **Inerte** | Códigos de otro sistema (TUE-24, GRQ-20…) que no cruzan con ningún `task_code` |

### Tasks — 15 columnas

| Columna | Clase | Por qué |
|---|---|---|
| `task_code`, `project_code` | Núcleo | Claves |
| `due_date` | **Núcleo** | Vencimiento real y la detección de tareas que vencen después del deadline |
| `priority` | **Núcleo** | Conteo ponderado → prioridad derivada del proyecto |
| `status` | **Núcleo** | Tablero, tareas abiertas, "sin tarea en progreso" |
| `assignee_alias` | **Núcleo** | Única fuente de la carga por persona |
| `dependency` | **Núcleo** | El grafo, y el ciclo de PRJ-04 que ningún campo declara |
| `is_overdue` | **Contraste** | 34 de 82 mal. Se importa para mostrar la contradicción, jamás para decidir |
| `title` | Contexto | 82 únicos, pero 16 arquetipos + el nombre del proyecto |
| `assignee_role` | Contexto | 2 valores; se deriva del alias |
| `detail` | Contexto | 16 valores distintos para 82 filas |
| `engagement_type`, `client_alias`, `project_name` | **Inerte** | Desnormalización: copian Projects fila a fila |
| `last_progress` | **Inerte** | Copia exacta de `detail` en 82 de 82 filas. Cero señal de progreso |

### Team — 9 columnas · todas contraste

Los 7 numéricos coinciden exactamente con el recálculo desde Tasks, así que no aportan nada
nuevo — y omiten a Andrea Molina. Se importan para poder decir *"la capacidad declarada
concuerda, pero está incompleta"*; la carga que muestra la consola sale siempre de Tasks.

### Notas — 2 columnas

No son datos: son la descripción del ejercicio, con filas de prueba (`test | ok`, `x | y`) antes
del contenido real. Se descartan por forma, no por posición.

### Resumen

**10 columnas de 45 mueven el sistema.** 11 son contraste —existen para que la consola pueda
mostrar en qué miente el origen—, 8 dan contexto en pantalla y **9 son inertes**: redundantes
(`stage`, `project_type_api`, las tres desnormalizadas de Tasks), derivables (`owner_role`,
`assignee_role`), duplicadas (`last_progress`) o no vinculables
(`recent_completed_examples`). Se importan igual, porque descartar en la ingesta lo que hoy no
se usa obliga a reimportar el histórico el día que se necesite.

**La consecuencia de diseño:** el archivo tiene 45 columnas y una sexta parte carga toda la
decisión. El resto es contexto, redundancia o —en 11 casos— evidencia de que lo declarado no
coincide con lo real. Un sistema que tratara las 45 como equivalentes repartiría su confianza
al revés.

## 9. Distribución del backlog

| | Crítica | Alta | Media | Baja |
|---|---|---|---|---|
| Por hacer | 13 | 8 | 2 | 0 |
| En progreso | 0 | 13 | 8 | 0 |
| En revisión | 0 | 9 | 4 | 8 |
| Bloqueada | 0 | 8 | 9 | 0 |

Ninguna tarea está completada — Tasks es solo backlog abierto, como aclara la pestaña Notas.
**Las 13 críticas están todas en "Por hacer"**: nadie ha empezado ninguna. Y hay exactamente
**una tarea "En progreso" por proyecto** en 21 de 22 proyectos (la excepción es PRJ-21, con
cero), lo que hace que "no tiene tarea en progreso" sea un detector casi perfecto de proyecto
abandonado.

---

## 10. Qué cambia esto en el sistema

1. **Recalcular todo contra hoy** deja de ser una opinión: `is_overdue` no es un cálculo, es un
   literal de plantilla que se contradice a sí mismo el 2026-07-11.
2. **Severidad graduada, no flags binarios** — con 17 copias del mismo caso, lo binario no
   ordena nada.
3. **Dos detecciones que los datos permiten y ningún campo declara**: tareas que vencen después
   del deadline del proyecto (12 casos) y ciclos de dependencias (PRJ-04). Ambas son funciones
   puras y no dependen de la fecha de hoy.
4. **Carga por persona desde Tasks** por completitud (Andrea Molina), no porque Team esté
   desactualizado.
5. **Cero features de texto o IA en el producto**, con la razón contada: 16 arquetipos de título
   para 82 tareas y `last_progress` duplicando `detail` en las 82 filas.
6. **`status`, `priority`, `next_step` y `notes` son campos del sistema**, no del origen.

# Aztec Ops Console

Consola de seguimiento y priorización para un portafolio de proyectos activos al mismo tiempo: qué atender primero, qué está bloqueado o en riesgo, y por qué el sistema lo ordena así.

## El problema que resuelve

Cuando hay muchos proyectos corriendo en paralelo, la pregunta operativa del día a día no es "¿cómo va cada proyecto?" sino **"¿qué necesito atender hoy y en qué orden?"**. Eso exige dos cosas que rara vez conviven: un criterio de priorización que se pueda explicar en una frase, y una detección de riesgo que no dependa de que alguien se acuerde de actualizar un campo a mano.

La consola resuelve ambas. Un detalle de diseño importante: **los datos declarados por el origen (estado, fechas de vencimiento, salud del proyecto) no se toman como verdad**. Cualquier sistema que ingiera datos operativos de otra fuente — un CRM, una plataforma de proyectos, un export periódico — puede terminar con campos que quedaron desactualizados o que se contradicen entre sí. La consola recalcula todo (riesgo, bloqueo, urgencia) contra la fecha de hoy en cada lectura, y muestra la discrepancia cuando lo declarado y lo calculado no coinciden, en vez de ocultarla.

## Cómo levantarlo

Requisitos: Node 22+, [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm db:reset   # crea la base SQLite y la puebla desde el dataset de origen
pnpm dev        # http://localhost:3000
```

Otros comandos útiles:

```bash
pnpm test       # motor de detección y score — corre pnpm db:reset antes, automáticamente
pnpm build      # build de producción
pnpm lint       # eslint
```

**Nota operativa:** si el servidor de desarrollo está corriendo, detenelo antes de `pnpm db:reset` (`pkill -f "next dev"` o Ctrl+C). SQLite en modo WAL no tolera bien que el archivo de base se borre mientras hay una conexión abierta — puede corromper el archivo.

Variables de entorno opcionales (todas tienen default razonable, no hace falta configurarlas para levantar el proyecto):

| Variable | Para qué |
|---|---|
| `APP_TODAY` | Congela la fecha contra la que se calculan riesgo y urgencia (`YYYY-MM-DD`). Sin ella, usa una fecha fija de referencia. |
| `DB_PATH` | Ruta del archivo SQLite. Default: `data/aztec.db`. |
| `SOURCE_XLSX` | Ruta del archivo de origen a importar. Default: el dataset incluido en el repo. |

## Qué hace

- **Detección de riesgo, con severidad graduada.** Tres estados — bloqueado, en riesgo, sin siguiente paso claro — cada uno con una severidad de 0 a 100, no un simple sí/no. Un portafolio real rara vez tiene la mitad de los proyectos en el mismo nivel de urgencia; la severidad es lo que permite ordenar dentro de cada categoría en vez de solo contarlos.
- **Priorización transparente.** Cada proyecto tiene un score desglosado y visible, no una caja negra (ver más abajo).
- **Colas por tipo de trabajo.** Proyecto, diagnóstico y mantenimiento no compiten por el mismo orden — son tipos de trabajo distintos, con dinámicas distintas.
- **Carga por persona.** Calculada directamente desde las tareas asignadas, no desde un reporte de capacidad que puede quedar desactualizado.
- **Tablero de tareas por proyecto**, organizado por estado, con el detalle completo de cada tarea (a quién está asignada, de qué depende, prioridad) y dos acciones puntuales: desbloquear una tarea y fijarla como siguiente paso del proyecto.
- **Historial de cambios** por proyecto — cada edición queda registrada, no solo el valor final.
- **Notas de calidad de datos**, por proyecto y en un panel global — qué se tuvo que normalizar o qué contradicción se encontró al importar, sin corregir nada en silencio.

## Criterio de priorización

```
score = 0.5 · urgencia + 0.3 · prioridad + 0.2 · flags
```

- **Urgencia** — una curva continua sobre los días de atraso o de anticipación a la fecha límite, no por escalones. Con escalones fijos, todo lo que está "muy vencido" empataría en el mismo valor y el orden dentro de ese grupo se perdería; con una curva continua, dos días de diferencia siguen separando a dos proyectos en la cola.
- **Prioridad** — se deriva del conteo ponderado de tareas abiertas por nivel de prioridad (una tarea crítica pesa más que varias de baja prioridad), con la opción de fijarla a mano cuando el criterio automático no aplica. Un proyecto sin tareas abiertas pero con una fecha vencida no se trata como "baja prioridad" — la ausencia de actividad sobre una fecha vencida es en sí misma una señal de que algo necesita revisión.
- **Flags** — un proyecto bloqueado o sin siguiente paso claro suma puntos adicionales al score, además de aparecer marcado como tal.
- **Desempate** — a igual score, se prioriza el proyecto de mayor valor de negocio conocido; un valor desconocido nunca se trata como cero (eso lo pondría antes que un proyecto de bajo valor real).

Los pesos (0.5 / 0.3 / 0.2) son una decisión de diseño, no una verdad matemática — lo importante es que están definidos, son visibles al expandir cada proyecto, y se pueden ajustar sin tocar el resto del sistema.

## Ejemplos incluidos

El conjunto de datos de origen viene con estados y prioridades poco variados. Para que el sistema se pueda evaluar con casos representativos desde el primer arranque, se incluyen tres proyectos de ejemplo con estados y prioridades distintas (uno en pausa con prioridad baja, uno cerrado con fecha vencida para confirmar que no genera alertas, uno activo y crítico sin siguiente paso definido).

## Decisiones de alcance

- **Sin funciones de IA en el producto.** La señal disponible en los datos de origen es estructural — fechas, estados, prioridades, relaciones de dependencia entre tareas — no hay texto lo bastante variado como para que un resumen o una clasificación automática aporten algo que la estructura ya no muestre.
- **Tareas de solo lectura, con dos acciones puntuales** (fijar siguiente paso, desbloquear), no un CRUD completo. El proyecto es la unidad sobre la que se decide y se edita; la tarea es la evidencia que alimenta esa decisión.
- **Sin autenticación, sin despliegue, sin actualizaciones en tiempo real.** Corre localmente, con SQLite como base — suficiente para un prototipo funcional, no para producción.
- **Sin edición del equipo.** La carga por persona se calcula, no se administra manualmente.

## Stack

Next.js (App Router) + TypeScript, SQLite vía Drizzle ORM, Tailwind. El motor de detección y priorización (`lib/engine/`) es un conjunto de funciones puras, sin dependencias del framework, con su propia batería de pruebas.

---

Uso interno. Todos los derechos reservados.

## Metadatos de la propuesta

| Propiedad | Valor |
| --- | --- |
| `Nombre_Propuesta` | Propuesta “Integración de Envío de Avisos y Turnos a SAP” |
| `Codigo_Propuesta` | PS-2026-1706-01 |
| `Version` | 1.0.0 |
| `Fecha_Propuesta` | 17 de junio del 2026 |
| `Validez_Dias` | 45 |
| `Responsable_PM` | Cinthia Burbano |

---

# MANTICORE LABS

# Propuesta “Integración de Envío de Avisos y Turnos a SAP”

| Campo | Valor |
| --- | --- |
| Número referencial | PS-2026-1706-01 |
| Versión | 1.0.0 |
| Fecha | 17 de junio del 2026 |
| Válido por | 45 días |
| CONTACTANOS | [info@manticore-labs.com](mailto:info@manticore-labs.com) |

---

## Índice

| Sección | Página |
| --- | --- |
| Propuesta “Integración de Envío de Avisos y Turnos a SAP” | 1 |
| Objetivos | 4 |
| Descripción y metodología | 4 |
| Responsabilidad del Proveedor | 6 |
| Responsabilidad del Cliente | 6 |
| Descripción de la solución | 7 |
| HU021 - Confirmación de envío de avisos a SAP | 7 |
| HU022 - Cargar turnos programados a SAP | 7 |
| Personal | 8 |
| Actividades | 8 |
| No Incluye | 9 |
| Tiempos y costos de la solución | 10 |
| Nota | 10 |
| Forma de pago | 11 |
| Conclusiones | 12 |

---

## Objetivos

El presente documento tiene como objetivo describir el alcance funcional, técnico y económico para la implementación del flujo de confirmación, envío, validación y reproceso de información hacia SAP, correspondiente a avisos programados y turnos programados por máquina.

La solución busca garantizar que la información enviada a SAP se encuentre asociada al planificador, usuario, fecha y ciclo correctos, reduciendo errores de transferencia y permitiendo validar la cantidad de registros cargados antes de finalizar el proceso.

---

## Descripción y metodología

Manticore Labs se va a encargar del desarrollo de los nuevos módulos y modificaciones solicitadas, vale la pena revisar las fases de desarrollo de software y la metodología que se va a utilizar. La metodología dentro del equipo de Manticore Labs es SCRUM. A continuación se va a describir la metodologías y las fases de desarrollo:

**Imagen 1 - Proceso integral de desarrollo de software**

- **Requerimientos**
    - Se toman los requerimientos del sistema
- **Diseño**
    - Se evalúan los requerimientos para transformarlos en historias de usuario
- **Desarrollo**
    - Se desarrollan los requisitos
- **Pruebas**
    - Se evalúa que cumplan los requerimientos implementados por el equipo de desarrollo
- **Despliegue**
    - Se envían los cambios a los servidores de pruebas o producción
- **Operaciones**
    - Se revisa que el proceso haya culminado satisfactoriamente en el ambiente deseado

Dentro de la metodología SCRUM el proceso es levantar los requerimientos, luego ir construyéndose en un período corto de tiempo para que el cliente pueda validarlos.

**Imagen 2 - Metodología Scrum**

Los roles de SCRUM son una pieza fundamental para definir las responsabilidades dentro del proyecto.

**Imagen 3 - Diagrama de costo del cambio**

En la siguiente tabla se definen los diferentes roles de SCRUM:

| Rol | Responsable Manticore Labs |
| --- | --- |
| Product Owner | Cliente |
| Scrum Master | Cinthia Burbano |
| QA | Jonathan Suasnabas |
| Equipo de Desarrollo | Equipo de Manticore Labs |

> ** Cada uno de los responsables de los distintos “Módulos” del sistema se irán delimitando mediante se avanza con las reuniones de requerimientos.
> 

---

## Responsabilidad del Proveedor

La responsabilidad del Product Owner es asegurarse de que están entregando el mayor valor.

La responsabilidad del Scrum Master es unir todo y garantizar que el proceso de SCRUM se haga bien. En términos prácticos, eso significa que ayudan al product owner a definir el valor, al equipo de desarrollo a entregar el valor y al equipo de scrum a mejorar.

La responsabilidad del equipo de desarrollo es llevar a cabo el desarrollo, implementación y despliegue del aplicativo, así cómo la solución de cualquier tipo de errores que se tenga.

---

## Responsabilidad del Cliente

Los responsables de cada uno de los módulos tienen la responsabilidad de aprobar y revisar los requerimientos del sistema. En el caso de modificaciones se evaluarán si se necesita una redefinición del alcance del sistema. Es importante que se intenten definir bien los requerimientos y sacar todos los flujos al principio del desarrollo ya que el costo del cambio se va incrementando mientras va avanzando el proyecto.

El siguiente gráfico demuestra que mientras se descubren cambios en las primeras etapas del desarrollo del sistema serán mucho menos costosos de implementar. Dentro del proyecto se tendrá cómo referencia los requerimientos levantados durante las primeras sesiones de trabajo para la elaboración del contrato. En el caso de haber requerimientos aprobados y estén en etapas de desarrollo, pruebas o despliegue se evaluará si estos cambios pueden ser implementados sin costos adicionales o con costos adicionales, la responsabilidad será de cada uno de los responsables del módulo.

**Imagen 4 - Diagrama de costo del cambio**

---

## Descripción de la solución

La solución contempla la implementación de un flujo controlado para el envío de avisos programados y turnos programados a SAP. El proceso incorpora una ventana modal de confirmación, validación de datos previos al envío, consumo de APIs SAP, manejo de errores, reproceso, consulta posterior de registros cargados y navegación secuencial entre pantallas del proceso.

### HU021 - Confirmación de envío de avisos a SAP

Como planificador, se requiere contar con una ventana emergente de confirmación que permita verificar los datos necesarios antes de enviar los avisos programados al sistema SAP.

- Mostrar la ventana modal con el título “Enviar a SAP” al presionar el botón del mismo nombre en la pantalla de Avisos.
- Permitir reintento desde el botón “ENVIAR A SAP” cuando el envío falle.
- Ejecutar el envío real hacia SAP cuando el usuario presione “Continuar”, utilizando el API proporcionada por el cliente.
- Mostrar mensaje de éxito cuando el envío finalice correctamente.
- Mostrar mensaje de error y opción de reprocesar cuando el envío falle.
- Ejecutar reproceso considerando que SAP debe eliminar lo cargado previamente para el ciclo correspondiente y el sistema debe volver a enviar la información.
- Consultar a SAP la cantidad de registros cargados por transacción y comparar con la cantidad enviada antes de mostrar el mensaje final de éxito.
- Luego del mensaje de éxito, permitir continuar hacia la pantalla Matriz por Turnos y repetir el procedimiento de envío a SAP.
- Continuar el flujo hacia la pantalla Avisos y posteriormente hacia Resumen por Turno, finalizando el proceso cuando corresponda.

### HU022 - Cargar turnos programados a SAP

Como planificador, se requiere poder cargar a SAP la información de turnos programados por máquina, permitiendo que el proceso se ejecute con las validaciones, estructura de datos y mensajes definidos para la integración.

- Consumir el API de SAP correspondiente a la carga de turnos programados.
- Armar la estructura de datos requerida por el servicio.
- Crear validaciones de envío antes de ejecutar la carga.
- Construir la pantalla requerida para visualizar y ejecutar el proceso.
- Mostrar mensajes de resultado y errores asociados al consumo del servicio.

---

## Personal

El personal requerido para las diferentes fases del proyecto, son necesarios ya que se maneja entregas parciales del proyecto, estas entregas son ITERATIVAS incrementales, por lo cual en cada fase cada miembro del equipo realiza partes fundamentales para realizar las entregas a tiempo, con la calidad necesaria.

| Rol | Cantidad | Descripción del Rol |
| --- | --- | --- |
| Programador Full Stack Senior | 1 | Conocimiento amplio del stack tecnológico y experiencia amplia |
| Revisor de Calidad de Software | 1 | Revisión de bugs y errores al momento de terminar las Historias de Usuario y que estén listas para las Demos con el cliente |
| Project Manager | 1 | Seguimiento del proyecto |

> **NOTA:** Manticore labs no se responsabiliza por despliegues ni problemas presentados en ambientes del cliente. En caso de tener un flujo DevOps Manticore Labs brindará los comandos para levantar el aplicativo pero no será responsable de implementar nuevos flujos ni tampoco de problemas de ambiente que se tengan durante el despliegue. Manticore Labs es responsable del código y lógica de negocio escrita en el mismo.
> 

---

## Actividades

| Sistema/HU | Actividad | Descripción | Horas |
| --- | --- | --- | --- |
| HU021 | Análisis de flujo SAP | Analizar el flujo completo de envío a SAP según documentación proporcionada por el cliente. | 4 |
| HU021 | Diseño de modal “Enviar a SAP” | Diseñar estructura visual y funcional de la ventana modal de confirmación. | 4 |
| HU021 | Endpoint backend de envío | Crear endpoint backend para iniciar el envío de matriz macro y avisos a SAP. | 8 |
| HU021 | Integración API SAP | Implementar envío de datos al API SAP usando los parámetros exigidos. | 10 |
| HU021 | Manejo de errores | Crear manejo de errores por tipo: fallo SAP, timeout y error de datos. | 8 |
| HU021 | Reintento | Implementar lógica de reintento desde el botón “ENVIAR A SAP”. | 4 |
| HU021 | Respuesta estandarizada | Crear estructura de respuesta de éxito, error y detalle. | 4 |
| HU021 | Acción Continuar | Implementar acción “Continuar” para ejecutar envío real y avanzar entre pantallas. | 6 |
| HU021 | Reproceso SAP | Integrar flujo de reenvío y eliminación previa en SAP según reglas del cliente. | 10 |
| HU021 | Validación posterior | Consultar a SAP cuántos registros fueron cargados y comparar con lo enviado. | 8 |
| HU021 | Resumen por turnos | Construcción de tabla de resumen por turnos. | 6 |
| HU021 | Envío resumen por turno | Implementar envío del resumen por turno a SAP con estructura planteada. | 4 |
| HU021 | Consulta de avisos | Integración con servicio de consulta de avisos. | 2 |
| HU021 | Pruebas unitarias | Ejecución de pruebas unitarias y ajustes derivados. | 2 |
| HU022 | Consumo API turnos | Consumir API para carga de turnos programados. | 8 |
| HU022 | Estructura de datos | Armar estructura de datos requerida para envío. | 8 |
| HU022 | Validaciones de envío | Crear validaciones previas al envío. | 8 |
| HU022 | Pantalla de carga | Construir pantalla para carga de turnos programados. | 8 |
| HU022 | Pruebas funcionales | Validación funcional de pantalla e integración. | 4 |
| **Total** |  | **Horas estimadas** | **116** |

---

## No Incluye

La presente cotización no incluye:

- Creación, modificación o mantenimiento de APIs SAP del cliente.
- Corrección de errores, indisponibilidad o cambios en servicios SAP externos.
- Definición funcional de reglas internas de SAP no documentadas por el cliente.
- Cambios en estructuras JSON, endpoints, autenticación o parámetros no entregados al inicio del proyecto.
- Creación de nuevos reportes o dashboards no descritos en el alcance.
- Integraciones con sistemas externos adicionales a SAP.
- Migración o depuración histórica de información.
- Cambios en reglas de negocio fuera del flujo de confirmación, envío, validación y reproceso descrito.
- Despliegues productivos o configuraciones de infraestructura del cliente no coordinadas previamente.
- Reuniones con otros proveedores que no estén relacionadas directamente con la validación técnica de las APIs incluidas.

---

## Tiempos y costos de la solución

Las etapas de la solución son:

| Etapa | Tiempo estimado | Detalle |
| --- | --- | --- |
| Desarrollo backend e integración | 78 horas | Construcción de endpoints, consumo de APIs SAP, reproceso, validación posterior y respuestas estandarizadas. |
| Desarrollo frontend | 24 horas | Construcción de modal, pantalla de turnos, mensajes, botones de envío, continuar y reprocesar. |
| Pruebas internas | 10 horas | Pruebas unitarias, funcionales, validación de errores, reintentos y comparación de registros. |
| UAT y ajustes | 4 horas | Acompañamiento a validación del cliente y corrección de observaciones dentro del alcance. |

La duración estimada del proyecto será de aproximadamente **6 a 7 semanas**, contadas a partir de la aprobación formal del inicio del proyecto, disponibilidad de APIs SAP, ambientes, credenciales, documentación técnica y usuarios funcionales para validación.

| Descripción | Precio |
| --- | --- |
| Desarrollo de la solución | $2,900.00 |
| Subtotal | $2,900.00 |
| I.V.A. | $435.00 |
| Total | $3,335.00 |

> ** NO INCLUYE MODIFICACIONES DE REQUERIMIENTOS
> 

---

## Nota

Se establecerá un límite de tiempo posterior a la entrega y notificación de finalización para que el cliente realice la validación y/o despliegue correspondiente.

- Una vez transcurrido este tiempo, se considerará el trabajo como finalizado.
- En caso de que el cliente no realice pruebas o despliegues dentro del plazo definido, las horas adicionales de soporte, revisión o validación serán facturadas como servicio adicional.
- Se aclara que cualquier mal uso del sistema o configuraciones incorrectas realizadas por el cliente, que requieran soporte adicional, serán también facturadas.
- Todo tiempo invertido en revisiones o atención de incidencias fuera del alcance de la entrega será contabilizado y cobrado.
- No incluye reuniones con otros proveedores.
- Solo incluye una hora de revisión.

Esta cláusula busca evitar reprocesos innecesarios, optimizar el uso del tiempo del equipo y garantizar la correcta gestión del sistema por parte del cliente.

Debido al alcance transversal de la solución sobre cinco sistemas corporativos, las estimaciones consideran únicamente los componentes identificados durante el levantamiento inicial. En caso de identificarse nuevas dependencias, pantallas, vistas, reportes o procesos afectados durante la ejecución, estas serán analizadas y gestionadas mediante el proceso formal de control de cambios.

---

## Forma de pago

- **Fase 1 - Inicio del Proyecto**
    - **Hito:** Inicio formal del proyecto.
    
    **Entregables asociados:**
    
    - Acta de inicio del proyecto aprobada por el cliente.
    - Planificación inicial y cronograma de ejecución.
    
    **Condición de pago:**
    
    Para dar inicio al proyecto, el Comprador deberá cancelar el 50% del valor total del proyecto, correspondiente a **USD 1,450.00 más IVA**.
    
- **Fase 2 - Entrega de Desarrollo**
    - **Hito:** Entrega de los componentes desarrollados en ambiente de desarrollo.
    
    **Entregables asociados:**
    
    - Ventana modal “Enviar a SAP”.
    - Endpoints backend para envío, reintento, validación y reproceso.
    - Integración con APIs SAP proporcionadas para avisos y turnos.
    - Pantalla de carga de turnos programados.
    - Mensajes de éxito, error, reproceso y navegación entre pantallas.
    - Evidencias de pruebas internas ejecutadas.
    - Acta de entrega para validación funcional.
    
    **Condición de pago:**
    
    El Comprador deberá cancelar el 50% restante del valor total del proyecto, correspondiente a **USD 1,450.00 más IVA**, una vez ejecutada la validación y aprobado el entregable correspondiente.
    

---

## Conclusiones

- Se ha definido la descripción de la solución y la propuesta para llevar a cabo los requerimientos solicitados.
- El costo puede variar dependiendo de la arquitectura que se va a utilizar.

---

Para mayor información: [info@manticore-labs.com](mailto:info@manticore-labs.com)

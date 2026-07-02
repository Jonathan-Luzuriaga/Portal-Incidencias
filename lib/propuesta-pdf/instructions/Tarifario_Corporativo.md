# Tarifario Corporativo — Manticore Labs 2026

Tarifas vigentes por rol, reglas de facturacion y formas de pago. El agente usa este archivo para calcular subtotales y determinar esquemas de pago.

---

## Tarifas por rol

| Rol | Categoria | Costo/Hora (USD) | Notas |
|---|---|---|---|
| Arquitecto de Solucion / PM | Gestion | $35.00 | Incluye gestion de proyecto y definicion de arquitectura. Rol de mayor costo por responsabilidad transversal. |
| Programador Senior (Full Stack / Front) | Desarrollo | $25.00 | Aplica para desarrollo backend y frontend de alta complejidad. |
| Programador Semi-Senior | Desarrollo | $20.00 | Aplica para modulos de complejidad media bajo supervision de Senior. |
| Revisor de Calidad (QA) | Pruebas | $20.00 | Incluye pruebas funcionales, UAT y documentacion de hallazgos. No incluye automatizacion de pruebas. |
| Programador Junior | Desarrollo | $16.00 | Tareas de baja complejidad, mantenimiento y soporte bajo supervision. |
| Consultor Especialista (SAP / GAMP) | Consultoria | $25.00 | Exclusivo para proyectos SAP ECC y procesos regulados bajo GAMP 5. Se factura por paquete de dias (niveles). |

---

## Reglas de facturacion

1. **IVA no incluido:** Todos los valores son antes de impuestos. La propuesta final debe agregar el 15% de I.V.A. sobre el subtotal.
2. **QA siempre se factura:** El historico demuestra que omitir QA genera perdidas directas (ver Ficha KAM en Historico de Proyectos). Es una linea no removible.
3. **Consultoria SAP:** Se factura por paquetes de dias — Nivel 0 = 128h, Nivel 1 = ~320h. No por hora individual.
4. **Rol mixto:** Si el Arquitecto tambien actua como PM en el mismo proyecto, se usa la tarifa de $35/h sin duplicar el rol.
5. **Descuentos:** Solo se aplican con aprobacion explicita del Director. El unico proyecto con descuento documentado en el historico es Matriculacion (PS-2026-1301-02).

---

## Formas de pago segun subtotal

La forma de pago se determina segun el subtotal antes de IVA. Cualquier excepcion requiere aprobacion del Director.

| Rango del Subtotal (USD) | Esquema | Detalle |
|---|---|---|
| Menos de $5,000 | 1 pago | 100% al inicio del proyecto |
| Entre $5,000 y $15,000 | 2 pagos | 50% al inicio — 50% contra entrega |
| Mas de $15,000 | 3 pagos | 30% al inicio — 30% a la firma del acta de pruebas — 40% a la entrega final |

---

## Referencia historica de tarifas cobradas

Comparacion entre lo cobrado en proyectos pasados y el tarifario vigente. Util para detectar desviaciones.

| Proyecto | Fase | Horas | Precio cobrado | Costo/hora real | Vs. tarifario actual |
|---|---|---|---|---|---|
| Sistema CRM | Desarrollo | 1,760h | $45,980.00 | $26.12/h | Por debajo del Senior ($25) + Arq ($35) |
| Sistema CRM | Pruebas QA | 640h | $12,800.00 | $20.00/h | Correcto |
| Servicios Administrativos | Desarrollo | 1,240h | $36,200.00 | $29.19/h | Aceptable |
| Servicios Administrativos | Pruebas QA | 600h | $6,400.00 | $10.66/h | Muy por debajo — perdida de rentabilidad |
| Matriculacion | Desarrollo | 258h | $6,450.00 | $25.00/h | Correcto |
| Matriculacion | Pruebas QA | 24h | $480.00 | $20.00/h | Correcto |
| Ficha KAM | Desarrollo | 1,400h | $45,400.00 | $32.42/h | Cercano al Arq ($35) |
| Ficha KAM | Pruebas QA | 520h | $0.00 | $0.00/h | No facturado — perdida directa |
| Actualizacion LOPD | Desarrollo | ~85h | $2,400.00 | ~$28.23/h | Aceptable |
| Actualizacion LOPD | Pruebas | 20h | $384.00 | $19.20/h | Correcto |
| SAP ECC GAMP 5 (Nivel 0) | Consultoria | 128h | $2,200.00 | $17.18/h | Por debajo del Consultor ($25) |
| SAP ECC GAMP 5 (Nivel 1) | Consultoria | ~320h | $6,800–$8,000 | ~$21–$25/h | En el limite inferior |

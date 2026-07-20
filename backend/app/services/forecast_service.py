"""Proyección de vistas hasta fin de año — extiende los puntos reales de
`get_evolutivo` con puntos adicionales marcados `es_proyectado=True`.

Método: regresión lineal ponderada por recencia sobre `vistas_totales` de
los puntos reales ya agregados (misma agregación que usa el chart, no una
consulta aparte). Deliberadamente NO se usa un modelo estacional (tipo
Holt-Winters): eso requiere al menos 2 ciclos completos de historia para no
inventar un patrón que los datos todavía no sustentan (ver
[[podpulse-project-constitution]] — nunca asumir una regla que el dato no
confirma, y [[data-engineering-postgresql]] — no fabricar información).
Feature nueva, sin precedente en el Power BI original.

Es exclusivamente Admin-facing: quien llama a `con_proyeccion` ya verificó
el rol antes (ver `dashboard_service.get_evolutivo` / endpoint), este módulo
no conoce usuarios ni permisos.
"""

from datetime import date

import numpy as np

from app.schemas.dashboard import EvolutivoPoint, Granularidad

# Con menos puntos que esto, un ajuste lineal es más ruido que señal — se
# devuelve la serie sin proyección en vez de arriesgar una tendencia falsa.
_MIN_POINTS_FOR_FORECAST = 4


def _iso_weeks_in_year(anio: int) -> int:
    """El 28 de diciembre siempre cae en la última semana ISO del año —
    truco estándar para no reimplementar el cálculo de semanas 52 vs 53."""
    return date(anio, 12, 28).isocalendar()[1]


def _weighted_linear_forecast(valores: list[int], pasos: int) -> list[int]:
    """Ajuste lineal por mínimos cuadrados, ponderado para que los puntos
    más recientes pesen más que los antiguos (la tendencia reciente importa
    más que el promedio de todo el histórico)."""
    if pasos <= 0:
        return []
    n = len(valores)
    x = np.arange(n, dtype=float)
    pesos = np.linspace(0.5, 1.5, n)
    pendiente, intercepto = np.polyfit(x, valores, deg=1, w=pesos)
    x_futuro = np.arange(n, n + pasos, dtype=float)
    return [max(0, round(pendiente * fx + intercepto)) for fx in x_futuro]


def con_proyeccion(
    puntos: list[EvolutivoPoint], granularidad: Granularidad
) -> list[EvolutivoPoint]:
    """Agrega puntos proyectados hasta el 31/12 del año del último punto
    real. Solo aplica a granularidad semana/mes: a nivel día el horizonte
    sería demasiado ruidoso, y a nivel año no hay sub-puntos que proyectar
    dentro del propio año."""
    if granularidad not in (Granularidad.SEMANA, Granularidad.MES):
        return puntos
    if len(puntos) < _MIN_POINTS_FOR_FORECAST:
        return puntos

    valores = [p.vistas_totales for p in puntos]

    if granularidad == Granularidad.MES:
        anio_str, mes_str = puntos[-1].periodo.split("-")
        anio, mes = int(anio_str), int(mes_str)
        pasos = 12 - mes
        futuros = _weighted_linear_forecast(valores, pasos)
        proyectados = [
            EvolutivoPoint(
                periodo=f"{anio}-{mes + i:02d}",
                vistas_totales=v,
                metrica_secundaria=None,
                es_proyectado=True,
            )
            for i, v in enumerate(futuros, start=1)
        ]
    else:
        anio_str, semana_str = puntos[-1].periodo.split("-W")
        anio, semana = int(anio_str), int(semana_str)
        pasos = _iso_weeks_in_year(anio) - semana
        futuros = _weighted_linear_forecast(valores, pasos)
        proyectados = [
            EvolutivoPoint(
                periodo=f"{anio}-W{semana + i:02d}",
                vistas_totales=v,
                metrica_secundaria=None,
                es_proyectado=True,
            )
            for i, v in enumerate(futuros, start=1)
        ]

    return puntos + proyectados

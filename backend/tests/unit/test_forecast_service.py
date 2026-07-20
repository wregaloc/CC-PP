from app.schemas.dashboard import EvolutivoPoint, Granularidad
from app.services.forecast_service import _iso_weeks_in_year, con_proyeccion


def _puntos_mes(valores: list[int], anio: int, mes_inicial: int) -> list[EvolutivoPoint]:
    return [
        EvolutivoPoint(periodo=f"{anio}-{mes_inicial + i:02d}", vistas_totales=v)
        for i, v in enumerate(valores)
    ]


def _puntos_semana(valores: list[int], anio: int, semana_inicial: int) -> list[EvolutivoPoint]:
    return [
        EvolutivoPoint(periodo=f"{anio}-W{semana_inicial + i:02d}", vistas_totales=v)
        for i, v in enumerate(valores)
    ]


def test_con_proyeccion_ignora_granularidad_dia() -> None:
    puntos = [EvolutivoPoint(periodo="2026-01-01", vistas_totales=100)] * 10

    resultado = con_proyeccion(puntos, Granularidad.DIA)

    assert resultado == puntos


def test_con_proyeccion_ignora_granularidad_anio() -> None:
    puntos = [EvolutivoPoint(periodo="2026", vistas_totales=100)] * 10

    resultado = con_proyeccion(puntos, Granularidad.ANIO)

    assert resultado == puntos


def test_con_proyeccion_no_agrega_puntos_con_muy_poca_historia() -> None:
    puntos = _puntos_mes([100, 110, 120], anio=2026, mes_inicial=1)

    resultado = con_proyeccion(puntos, Granularidad.MES)

    assert resultado == puntos


def test_con_proyeccion_mensual_llega_hasta_diciembre() -> None:
    puntos = _puntos_mes([100, 110, 120, 130, 140], anio=2026, mes_inicial=1)

    resultado = con_proyeccion(puntos, Granularidad.MES)

    assert len(resultado) == 12
    proyectados = resultado[5:]
    assert all(p.es_proyectado for p in proyectados)
    assert [p.periodo for p in proyectados] == [f"2026-{m:02d}" for m in range(6, 13)]
    assert all(p.metrica_secundaria is None for p in proyectados)
    # tendencia creciente => la proyección debe seguir subiendo, no estancarse
    assert proyectados[-1].vistas_totales > proyectados[0].vistas_totales


def test_con_proyeccion_mensual_no_agrega_nada_si_ya_es_diciembre() -> None:
    puntos = _puntos_mes([100, 110, 120, 130, 140, 150, 160, 170, 190, 210, 230, 250], anio=2026, mes_inicial=1)

    resultado = con_proyeccion(puntos, Granularidad.MES)

    assert resultado == puntos


def test_con_proyeccion_semanal_respeta_las_52_o_53_semanas_del_anio() -> None:
    puntos = _puntos_semana([1000, 1050, 1100, 1150, 1200], anio=2026, semana_inicial=48)

    resultado = con_proyeccion(puntos, Granularidad.SEMANA)

    ultima_semana = _iso_weeks_in_year(2026)
    proyectados = resultado[5:]
    assert [p.periodo for p in proyectados] == [
        f"2026-W{s:02d}" for s in range(53, ultima_semana + 1)
    ]
    assert all(p.es_proyectado for p in proyectados)


def test_con_proyeccion_nunca_devuelve_vistas_negativas() -> None:
    # tendencia fuertemente decreciente — sin el piso en 0 el ajuste lineal
    # podría proyectar valores negativos, que no tienen sentido para vistas.
    puntos = _puntos_mes([500, 300, 100, 10, 1], anio=2026, mes_inicial=1)

    resultado = con_proyeccion(puntos, Granularidad.MES)

    proyectados = resultado[5:]
    assert all(p.vistas_totales >= 0 for p in proyectados)

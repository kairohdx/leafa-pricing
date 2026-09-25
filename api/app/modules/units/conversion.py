"""Exact-ratio unit conversion; no commercial or monetary rounding here."""
from decimal import Decimal, localcontext


def convert(quantity: Decimal, source, target) -> Decimal:
    if source.dimension_id != target.dimension_id:
        raise ValueError("Unidades dimensionalmente incompatíveis.")
    with localcontext() as context:
        context.prec = 50
        return (quantity * Decimal(source.factor_numerator) * Decimal(target.factor_denominator)
                / Decimal(source.factor_denominator) / Decimal(target.factor_numerator))

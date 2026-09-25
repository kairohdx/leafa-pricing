"""Pure pricing domain. All decimals cross JSON boundaries as strings."""
from decimal import Decimal, InvalidOperation, ROUND_CEILING, localcontext

FIELDS = {
    "markup_percent": ("percentage",),
    "target_margin": ("margin",),
    "margin_fees": ("margin", "fees", "fixed_cost"),
    "cost_multiplier": ("multiplier",),
    "fixed_addition": ("addition",),
}
ROUNDINGS = {"none", "integer", "ending_90", "ending_99"}
MAX_MONEY = Decimal("92233720368547758.07")


def decimal(value):
    if isinstance(value, (float, bool)) or not isinstance(value, (str, int, Decimal)):
        raise ValueError("Informe valores decimais como texto ou inteiro.")
    try:
        result = Decimal(value)
    except (InvalidOperation, ValueError):
        raise ValueError("Valor decimal inválido.") from None
    if not result.is_finite() or result < 0 or result > MAX_MONEY or result.as_tuple().exponent < -12:
        raise ValueError("Valor deve ser finito, não negativo, até 12 casas e dentro do limite monetário.")
    return result


def validate(strategy, parameters):
    if strategy not in FIELDS:
        raise ValueError("Estratégia desconhecida. Escolha uma das cinco estratégias disponíveis.")
    required = set(FIELDS[strategy])
    if not isinstance(parameters, dict) or required - parameters.keys() or parameters.keys() - required - {"rounding"}:
        raise ValueError("Parâmetros obrigatórios: " + ", ".join(FIELDS[strategy]) + "; opcional: rounding.")
    values = {key: decimal(parameters[key]) for key in required}
    rounding = parameters.get("rounding", "none")
    if not isinstance(rounding, str) or rounding not in ROUNDINGS:
        raise ValueError("Arredondamento inválido.")
    if values.get("margin", Decimal(0)) + values.get("fees", Decimal(0)) >= 100:
        raise ValueError("Margem mais taxas deve ser menor que 100%.")
    if strategy == "cost_multiplier" and values["multiplier"] <= 0:
        raise ValueError("Multiplicador deve ser maior que zero.")
    return values, rounding


def commercial_round(value, policy):
    if policy == "none":
        return value.quantize(Decimal("0.01"), rounding=ROUND_CEILING)
    if policy == "integer":
        return value.to_integral_value(rounding=ROUND_CEILING).quantize(Decimal("0.01"))
    ending = Decimal("0.90") if policy == "ending_90" else Decimal("0.99")
    candidate = value // 1 + ending
    return candidate if candidate >= value else candidate + 1


class PricingEngine:
    @staticmethod
    def calculate(cost, strategy, parameters):
        values, policy = validate(strategy, parameters)
        result = {"status": "unavailable", "reason": None, "base_cost": None,
                  "strategy_key": strategy, "parameters": dict(parameters),
                  "price_before_adjustment": None, "suggested_price": None, "adjustment": None, "details": {}}
        if cost is None:
            return result | {"reason": "Custo-base indisponível."}
        # Calculated costs can have more decimal places than user input.
        if not isinstance(cost, Decimal) or not cost.is_finite() or cost < 0:
            raise ValueError("Custo-base inválido.")
        result["base_cost"] = str(cost)
        with localcontext() as context:
            context.prec = 50
            if strategy == "markup_percent":
                raw = cost * (1 + values["percentage"] / 100)
            elif strategy == "target_margin":
                raw = cost / (1 - values["margin"] / 100)
            elif strategy == "margin_fees":
                raw = (cost + values["fixed_cost"]) / (1 - (values["margin"] + values["fees"]) / 100)
            elif strategy == "cost_multiplier":
                raw = cost * values["multiplier"]
            else:
                raw = cost + values["addition"]
            if raw > MAX_MONEY or cost > MAX_MONEY:
                return result | {"reason": "Cálculo excede o limite monetário."}
            final = commercial_round(raw, policy)
            if final > MAX_MONEY:
                return result | {"reason": "Arredondamento excede o limite monetário."}
            fees = final * values.get("fees", Decimal(0)) / 100
            margin = ((final - cost - values.get("fixed_cost", Decimal(0)) - fees) / final * 100) if final else None
            return result | {"status": "available", "base_cost": str(cost),
                "price_before_adjustment": str(raw), "suggested_price": str(final),
                "adjustment": str(final - raw), "details": {"rounding": policy,
                "fees_amount": str(fees), "resulting_margin_percent": str(margin) if margin is not None else None}}

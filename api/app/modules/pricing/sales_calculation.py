"""Apply a rule to captured costs, never reconstruct historical costs from the catalog."""
from decimal import Decimal, ROUND_HALF_UP, localcontext
from app.modules.pricing.engine import PricingEngine, MAX_MONEY


def calculate(lines, costs, rule):
    with localcontext() as context:
        context.prec = 50
        rows = []
        for line, captured in zip(lines, costs, strict=True):
            cost = Decimal(captured["base_cost"]) if captured.get("base_cost") is not None else None
            result = {"status": "unavailable", "reason": captured.get("reason") or "Selecione uma regra.", "suggested_price": None}
            if rule:
                try:
                    result = PricingEngine.calculate(cost, rule["strategy_key"], rule["parameters"])
                except ValueError as error:
                    result["reason"] = str(error)
            # Services have a catalog selling price, but no modeled cost.
            suggested = result.get("suggested_price")
            if line.kind.value == "service":
                suggested = str(line.unit_price_snapshot) if line.unit_price_snapshot is not None else None
                result = result | {"status": "available" if suggested is not None else "unavailable",
                                   "reason": "Preço cadastrado do serviço; custo indisponível.", "suggested_price": suggested}
            if suggested is not None and Decimal(suggested) > Decimal("9223372036854.775807"):
                suggested = None
                result = result | {"status": "unavailable", "reason": "Preço excede o limite de armazenamento unitário.", "suggested_price": None}
            total = (Decimal(suggested) * line.quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if suggested is not None else None
            if total is not None and total > MAX_MONEY:
                total = None
                result = result | {"status": "unavailable", "reason": "Total excede o limite monetário."}
            rows.append({"kind": line.kind.value, "quantity": str(line.quantity), "cost": captured,
                         "pricing": result, "suggested_total": str(total) if total is not None else None})
        def total(field):
            values = []
            for row in rows:
                value = row["cost"].get("base_cost") if field == "cost" else row["suggested_total"]
                if value is None:
                    return None
                values.append(Decimal(value) * Decimal(row["quantity"]) if field == "cost" else Decimal(value))
            amount = sum(values, Decimal(0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            return str(amount) if rows and amount <= MAX_MONEY else None
        return {"lines": rows, "cost_total": total("cost"), "suggested_total": total("price")}

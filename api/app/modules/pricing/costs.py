"""Cost domain and tenant-scoped catalog adapter. Packages describe material quantities."""
from decimal import Decimal, localcontext
from sqlalchemy import select
from app.core.dependencies import get_tenant_record, tenant_statement
from app.modules.materials.models import Material, MaterialPackage
from app.modules.products.models import Product, ProductMaterial
from app.modules.units.models import UnitOfMeasure
from app.modules.units.conversion import convert


class CostEngine:
    @staticmethod
    def component(purchase_cost, purchase_quantity, consumed_quantity, purchase_unit, consumed_unit):
        if purchase_quantity <= 0 or consumed_quantity <= 0 or purchase_cost < 0:
            raise ValueError("Quantidade ou custo inválido.")
        with localcontext() as context:
            context.prec = 50
            converted = convert(consumed_quantity, consumed_unit, purchase_unit)
            return converted, purchase_cost * converted / purchase_quantity

    @staticmethod
    def total(costs):
        with localcontext() as context:
            context.prec = 50
            return sum(costs, Decimal(0)) if costs else None


def material_cost(db, auth, material_id, quantity, unit_code):
    material = get_tenant_record(db, Material, material_id, auth)
    source = db.scalar(select(UnitOfMeasure).where(UnitOfMeasure.code == unit_code))
    target = db.scalar(select(UnitOfMeasure).where(UnitOfMeasure.code == material.purchase_unit_code))
    if source is None or target is None:
        raise ValueError("Unidade não encontrada.")
    converted, cost = CostEngine.component(material.purchase_cost, material.purchase_quantity, quantity, target, source)
    packages = list(db.scalars(tenant_statement(MaterialPackage, auth).where(
        MaterialPackage.material_id == material.id, MaterialPackage.archived_at.is_(None))))
    package_details = []
    for package in packages:
        package_unit = db.scalar(select(UnitOfMeasure).where(UnitOfMeasure.code == package.unit_code))
        _, package_cost = CostEngine.component(material.purchase_cost, material.purchase_quantity,
                                              package.quantity, target, package_unit)
        package_details.append({"id": str(package.id), "name": package.name,
                                "quantity": str(package.quantity), "unit_code": package.unit_code,
                                "cost": str(package_cost)})
    return {"material_id": str(material.id), "name": material.name, "quantity": str(quantity),
            "unit_code": unit_code, "purchase_unit_code": material.purchase_unit_code,
            "purchase_quantity": str(material.purchase_quantity), "purchase_cost": str(material.purchase_cost),
            "converted_quantity": str(converted), "cost": str(cost),
            "packages": package_details}


def product_cost(db, auth, product_id):
    get_tenant_record(db, Product, product_id, auth)
    components = list(db.scalars(tenant_statement(ProductMaterial, auth).where(ProductMaterial.product_id == product_id)))
    result = {"status": "unavailable", "reason": "Produto sem composição.", "base_cost": None, "components": []}
    try:
        rows = [material_cost(db, auth, c.material_id, c.quantity, c.unit_code) for c in components]
    except ValueError as error:
        return result | {"reason": str(error)}
    total = CostEngine.total([Decimal(row["cost"]) for row in rows])
    if total is None:
        return result
    return {"status": "available", "reason": None, "base_cost": str(total), "components": rows}

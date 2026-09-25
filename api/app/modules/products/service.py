from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_tenant_record, tenant_statement
from app.db.pagination import paginate
from app.db.types import utc_now
from app.modules.audit.models import AuditEvent
from app.modules.materials.models import Material
from app.modules.materials.service import compatible, editable
from app.modules.products.models import Product, ProductMaterial
from app.modules.products.schemas import ProductSummary


def detail(db, auth, product_id):
    record = db.scalar(tenant_statement(Product, auth).where(Product.id == product_id).options(selectinload(Product.materials)).execution_options(populate_existing=True))
    if record is None:
        raise HTTPException(404, "Product not found.")
    return record


def audit(db, auth, product, action, changes, request_id):
    db.add(AuditEvent(company_id=auth.company_id, actor_user_id=auth.user.id,
                      entity_type="product", entity_id=product.id, action=action,
                      changes=changes, request_id=request_id))


def finish(db, auth, product, action, changes, request_id):
    audit(db, auth, product, action, changes, request_id)
    db.commit()
    return detail(db, auth, product.id)


def list_products(db, auth, params, search=None, archived=False):
    statement = tenant_statement(Product, auth).where(Product.archived_at.is_not(None) if archived else Product.archived_at.is_(None))
    if search:
        statement = statement.where(Product.name.icontains(search, autoescape=True) | Product.sku.icontains(search, autoescape=True))
    return paginate(db, statement, params, ProductSummary, order_by=(Product.name.asc(), Product.id.asc()))


def create(db, auth, data, request_id):
    product = Product(**data.model_dump(), company_id=auth.company_id)
    db.add(product)
    db.flush()
    return finish(db, auth, product, "create", data.model_dump(mode="json"), request_id)


def edit(db, auth, product_id, data, request_id):
    product = get_tenant_record(db, Product, product_id, auth)
    editable(product)
    changes = {}
    for key, value in data.model_dump(exclude_unset=True).items():
        before = getattr(product, key)
        if before != value:
            changes[key] = {"before": before, "after": value}
            setattr(product, key, value)
    return finish(db, auth, product, "update", changes, request_id) if changes else detail(db, auth, product_id)


def archive(db, auth, product_id, archived, request_id):
    product = get_tenant_record(db, Product, product_id, auth)
    if (product.archived_at is not None) == archived:
        return detail(db, auth, product_id)
    product.archived_at = utc_now() if archived else None
    return finish(db, auth, product, "archive" if archived else "restore", {"archived": archived}, request_id)


def component(db, auth, product_id, component_id):
    record = db.scalar(tenant_statement(ProductMaterial, auth).where(ProductMaterial.id == component_id, ProductMaterial.product_id == product_id))
    if record is None:
        raise HTTPException(404, "Component not found.")
    return record


def add_material(db, auth, product_id, data, request_id):
    product = get_tenant_record(db, Product, product_id, auth)
    editable(product)
    material = get_tenant_record(db, Material, data.material_id, auth)
    editable(material)
    compatible(db, material.purchase_unit_code, data.unit_code)
    record = ProductMaterial(**data.model_dump(), company_id=auth.company_id, product_id=product.id)
    db.add(record)
    db.flush()
    product.updated_at = utc_now()
    audit(db, auth, product, "component_add", {"component_id": str(record.id), **data.model_dump(mode="json")}, request_id)
    db.commit()
    db.refresh(record)
    return record


def edit_material(db, auth, product_id, component_id, data, request_id):
    product = get_tenant_record(db, Product, product_id, auth)
    editable(product)
    record = component(db, auth, product_id, component_id)
    material = get_tenant_record(db, Material, record.material_id, auth)
    editable(material)
    compatible(db, material.purchase_unit_code, data.unit_code or record.unit_code)
    changes = {}
    for key, value in data.model_dump(exclude_unset=True).items():
        before = getattr(record, key)
        if before != value:
            changes[key] = {"before": str(before), "after": str(value)}
            setattr(record, key, value)
    if changes:
        product.updated_at = utc_now()
        audit(db, auth, product, "component_update", {"component_id": str(record.id), "changes": changes}, request_id)
        db.commit()
        db.refresh(record)
    return record


def remove_material(db, auth, product_id, component_id, request_id):
    product = get_tenant_record(db, Product, product_id, auth)
    editable(product)
    record = component(db, auth, product_id, component_id)
    audit(db, auth, product, "component_remove", {"component_id": str(record.id), "material_id": str(record.material_id),
                                                "quantity": str(record.quantity), "unit_code": record.unit_code}, request_id)
    db.delete(record)
    product.updated_at = utc_now()
    db.commit()

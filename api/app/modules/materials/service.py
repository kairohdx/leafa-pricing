from decimal import Decimal

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select

from app.core.dependencies import get_tenant_record, tenant_statement
from app.db.pagination import paginate
from app.db.types import utc_now
from app.modules.audit.models import AuditEvent
from app.modules.materials.models import Material, MaterialPackage
from app.modules.materials.schemas import MaterialRead, MaterialPackageRead
from app.modules.units.models import UnitOfMeasure


def unit(db, code):
    result = db.scalar(select(UnitOfMeasure).where(UnitOfMeasure.code == code))
    if result is None:
        raise HTTPException(422, "Unknown unit code.")
    return result


def compatible(db, first, second):
    if unit(db, first).dimension_id != unit(db, second).dimension_id:
        raise HTTPException(422, "Units must belong to the same dimension.")


def editable(record):
    if record.archived_at is not None:
        raise HTTPException(409, "Restore this record before editing it.")


def audit(db, auth, record, action, changes, request_id):
    db.add(AuditEvent(company_id=auth.company_id, actor_user_id=auth.user.id,
                      entity_type="material" if isinstance(record, Material) else "material_package",
                      entity_id=record.id, action=action, changes=jsonable_encoder(changes), request_id=request_id))


def finish(db, auth, record, action, changes, request_id):
    audit(db, auth, record, action, changes, request_id)
    db.commit()
    db.refresh(record)
    return record


def list_materials(db, auth, params, search=None, archived=False):
    statement = tenant_statement(Material, auth)
    if search:
        statement = statement.where(Material.name.icontains(search, autoescape=True) | Material.sku.icontains(search, autoescape=True))
    if archived is not None:
        statement = statement.where(Material.archived_at.is_not(None) if archived else Material.archived_at.is_(None))
    return paginate(db, statement, params, MaterialRead, order_by=(Material.name.asc(), Material.id.asc()))


def create_material(db, auth, data, request_id):
    unit(db, data.purchase_unit_code)
    record = Material(**data.model_dump(), company_id=auth.company_id)
    db.add(record)
    db.flush()
    return finish(db, auth, record, "create", data.model_dump(mode="json"), request_id)


def edit_material(db, auth, record_id, data, request_id):
    record = get_tenant_record(db, Material, record_id, auth)
    editable(record)
    if data.purchase_unit_code is not None:
        # Never reinterpret the dimension of an existing material or its history.
        compatible(db, record.purchase_unit_code, data.purchase_unit_code)
    return apply_patch(db, auth, record, data, request_id)


def apply_patch(db, auth, record, data, request_id):
    changes = {}
    encoded = data.model_dump(mode="json", exclude_unset=True)
    for field, value in data.model_dump(exclude_unset=True).items():
        before = getattr(record, field)
        if before != value:
            # Decimal audit values are strings, just like API contracts.
            changes[field] = {"before": str(before) if isinstance(before, Decimal) else before, "after": encoded[field]}
            setattr(record, field, value)
    return finish(db, auth, record, "update", changes, request_id) if changes else record


def list_packages(db, auth, material_id, params, archived=False):
    get_tenant_record(db, Material, material_id, auth)
    statement = tenant_statement(MaterialPackage, auth).where(MaterialPackage.material_id == material_id)
    if archived is not None:
        statement = statement.where(MaterialPackage.archived_at.is_not(None) if archived else MaterialPackage.archived_at.is_(None))
    return paginate(db, statement, params, MaterialPackageRead, order_by=(MaterialPackage.name.asc(), MaterialPackage.id.asc()))


def create_package(db, auth, data, request_id):
    material = get_tenant_record(db, Material, data.material_id, auth)
    editable(material)
    compatible(db, material.purchase_unit_code, data.unit_code)
    record = MaterialPackage(**data.model_dump(), company_id=auth.company_id)
    db.add(record)
    db.flush()
    return finish(db, auth, record, "create", data.model_dump(mode="json"), request_id)


def edit_package(db, auth, record_id, data, request_id):
    record = get_tenant_record(db, MaterialPackage, record_id, auth)
    editable(record)
    material = get_tenant_record(db, Material, record.material_id, auth)
    editable(material)
    compatible(db, material.purchase_unit_code, data.unit_code or record.unit_code)
    return apply_patch(db, auth, record, data, request_id)


def archive(db, auth, model, record_id, archived, request_id):
    record = get_tenant_record(db, model, record_id, auth)
    if isinstance(record, MaterialPackage) and not archived:
        editable(get_tenant_record(db, Material, record.material_id, auth))
    if (record.archived_at is not None) == archived:
        return record
    record.archived_at = utc_now() if archived else None
    return finish(db, auth, record, "archive" if archived else "restore", {"archived": archived}, request_id)

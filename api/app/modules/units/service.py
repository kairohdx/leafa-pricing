"""Global catalog. Mutations are only called by host administration."""
from fastapi import HTTPException
from sqlalchemy import select

from app.db.pagination import paginate
from app.modules.materials.models import Material, MaterialPackage
from app.modules.products.models import ProductMaterial
from app.modules.sales.models import SaleLine
from app.modules.units.models import UnitDimension, UnitOfMeasure
from app.modules.units.schemas import UnitDimensionRead, UnitOfMeasureRead


def get_record(db, model, record_id):
    record = db.get(model, record_id)
    if record is None:
        raise HTTPException(404, "Catalog record not found.")
    return record


def list_dimensions(db, params):
    return paginate(db, select(UnitDimension), params, UnitDimensionRead,
                    order_by=(UnitDimension.name.asc(), UnitDimension.id.asc()))


def list_units(db, params, dimension_id=None):
    statement = select(UnitOfMeasure)
    if dimension_id is not None:
        statement = statement.where(UnitOfMeasure.dimension_id == dimension_id)
    return paginate(db, statement, params, UnitOfMeasureRead,
                    order_by=(UnitOfMeasure.name.asc(), UnitOfMeasure.id.asc()))


def unit_in_use(db, code):
    return any(db.scalar(select(model.id).where(column == code).limit(1)) is not None
               for model, column in [(Material, Material.purchase_unit_code),
                                     (MaterialPackage, MaterialPackage.unit_code),
                                     (ProductMaterial, ProductMaterial.unit_code),
                                     (SaleLine, SaleLine.unit_code)])


def create_record(db, model, data):
    if model is UnitOfMeasure:
        get_record(db, UnitDimension, data.dimension_id)
    record = model(**data.model_dump())
    db.add(record)
    db.flush()
    return record


def edit_record(db, model, record_id, data):
    record = get_record(db, model, record_id)
    changes = {key: value for key, value in data.model_dump(exclude_unset=True).items() if getattr(record, key) != value}
    if model is UnitDimension:
        in_use = db.scalar(select(UnitOfMeasure.id).where(UnitOfMeasure.dimension_id == record.id).limit(1)) is not None
        protected = {"code", "storage_scale"}
    else:
        in_use = unit_in_use(db, record.code)
        protected = {"code", "dimension_id", "factor_numerator", "factor_denominator"}
        if "dimension_id" in changes:
            get_record(db, UnitDimension, changes["dimension_id"])
    if in_use and protected.intersection(changes):
        raise HTTPException(409, "Cannot change measurement semantics of a referenced catalog record.")
    for field, value in changes.items():
        setattr(record, field, value)
    db.flush()
    return record


def delete_record(db, model, record_id):
    record = get_record(db, model, record_id)
    if model is UnitDimension:
        in_use = db.scalar(select(UnitOfMeasure.id).where(UnitOfMeasure.dimension_id == record.id).limit(1)) is not None
    else:
        in_use = unit_in_use(db, record.code)
    if in_use:
        raise HTTPException(409, "Catalog record is in use.")
    db.delete(record)
    db.flush()


DIMENSIONS = [("count", "Contagem", 0), ("mass", "Massa", 6), ("length", "Comprimento", 6), ("area", "Área", 6), ("volume", "Volume", 6)]
UNITS = [("un", "Unidade", "un", "count", 1, 1),
         ("kg", "Quilograma", "kg", "mass", 1, 1), ("g", "Grama", "g", "mass", 1, 1000),
         ("m", "Metro", "m", "length", 1, 1), ("cm", "Centímetro", "cm", "length", 1, 100),
         ("mm", "Milímetro", "mm", "length", 1, 1000),
         ("m2", "Metro quadrado", "m²", "area", 1, 1),
         ("L", "Litro", "L", "volume", 1, 1), ("mL", "Mililitro", "mL", "volume", 1, 1000)]


def seed_catalog(db):
    dimensions = {}
    for code, name, scale in DIMENSIONS:
        dimension = db.scalar(select(UnitDimension).where(UnitDimension.code == code))
        if dimension is None:
            dimension = UnitDimension(code=code, name=name, storage_scale=scale)
            db.add(dimension)
            db.flush()
        elif dimension.storage_scale != scale:
            raise HTTPException(409, "Existing dimension conflicts with the seed.")
        dimensions[code] = dimension.id
    for code, name, symbol, dimension, numerator, denominator in UNITS:
        unit = db.scalar(select(UnitOfMeasure).where(UnitOfMeasure.code == code))
        if unit is None:
            db.add(UnitOfMeasure(code=code, name=name, symbol=symbol, dimension_id=dimensions[dimension],
                                  factor_numerator=numerator, factor_denominator=denominator))
        elif (unit.dimension_id, unit.factor_numerator, unit.factor_denominator) != (dimensions[dimension], numerator, denominator):
            raise HTTPException(409, "Existing unit conflicts with the seed.")
    db.flush()

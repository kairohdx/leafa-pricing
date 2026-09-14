from typing import Annotated
from uuid import UUID
from pydantic import Field
from app.schemas import Schema, Patch, Read, Code

class UnitDimensionCreate(Schema):
    code: Annotated[str, Field(min_length=1, max_length=30)]
    name: Annotated[str, Field(min_length=1, max_length=100)]
    storage_scale: Annotated[int, Field(strict=True, ge=0, le=6)] = 6

class UnitDimensionUpdate(Patch):
    code: Annotated[str, Field(min_length=1, max_length=30)] | None = None
    name: Annotated[str, Field(min_length=1, max_length=100)] | None = None
    storage_scale: Annotated[int, Field(strict=True, ge=0, le=6)] | None = None

class UnitDimensionRead(UnitDimensionCreate, Read):
    pass



class UnitOfMeasureCreate(Schema):
    code: Code
    name: Annotated[str, Field(min_length=1, max_length=100)]
    symbol: Code
    dimension_id: UUID
    factor_numerator: Annotated[int, Field(strict=True, gt=0, le=9223372036854775807)] = 1
    factor_denominator: Annotated[int, Field(strict=True, gt=0, le=9223372036854775807)] = 1

class UnitOfMeasureUpdate(Patch):
    code: Code | None = None
    name: Annotated[str, Field(min_length=1, max_length=100)] | None = None
    symbol: Code | None = None
    dimension_id: UUID | None = None
    factor_numerator: Annotated[int, Field(strict=True, gt=0, le=9223372036854775807)] | None = None
    factor_denominator: Annotated[int, Field(strict=True, gt=0, le=9223372036854775807)] | None = None

class UnitOfMeasureRead(UnitOfMeasureCreate, Read):
    pass

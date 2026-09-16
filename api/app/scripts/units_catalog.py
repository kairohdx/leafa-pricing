"""Host-only catalog administration. Never expose these mutations to tenants."""
import argparse
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import build_engine
from app.modules.units import service
from app.modules.units.models import UnitDimension, UnitOfMeasure
from app.modules.units.schemas import UnitDimensionCreate, UnitDimensionUpdate, UnitDimensionRead, UnitOfMeasureCreate, UnitOfMeasureUpdate, UnitOfMeasureRead


def main():
    parser = argparse.ArgumentParser(description="Global catalog maintenance; run with application writes paused.")
    parser.add_argument("action", choices=["seed", "create", "update", "delete"])
    parser.add_argument("--kind", choices=["dimension", "unit"])
    parser.add_argument("--id", type=UUID)
    parser.add_argument("--file", type=Path, help="UTF-8 JSON input for create/update")
    args = parser.parse_args()
    if args.action != "seed" and not args.kind:
        parser.error("--kind is required")
    if args.action in ("update", "delete") and not args.id:
        parser.error("--id is required")
    if args.action in ("create", "update") and not args.file:
        parser.error("--file is required")
    model, create, patch, read = ((UnitDimension, UnitDimensionCreate, UnitDimensionUpdate, UnitDimensionRead)
        if args.kind == "dimension" else (UnitOfMeasure, UnitOfMeasureCreate, UnitOfMeasureUpdate, UnitOfMeasureRead))
    engine = build_engine(get_settings().database_url)
    try:
        with Session(engine) as db, db.begin():
            if args.action == "seed":
                service.seed_catalog(db)
                output = "Catalog ready."
            elif args.action == "delete":
                service.delete_record(db, model, args.id)
                output = "Catalog record deleted."
            else:
                data = (create if args.action == "create" else patch).model_validate_json(args.file.read_text(encoding="utf-8"))
                record = (service.create_record(db, model, data) if args.action == "create"
                          else service.edit_record(db, model, args.id, data))
                output = read.model_validate(record).model_dump_json()
        print(output)
    except HTTPException as exc:
        parser.exit(1, f"{exc.status_code}: {exc.detail}\n")
    except (IntegrityError, ValidationError, OSError) as exc:
        parser.exit(1, f"Catalog operation failed ({type(exc).__name__}); transaction rolled back.\n")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()

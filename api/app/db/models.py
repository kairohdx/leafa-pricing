"""Import this registry before using Base.metadata (including Alembic)."""
from app.modules.companies.models import Company
from app.modules.identity.models import User, AuthSession
from app.modules.units.models import UnitDimension, UnitOfMeasure
from app.modules.materials.models import Material, MaterialPackage
from app.modules.products.models import Product, ProductMaterial
from app.modules.services.models import Service
from app.modules.pricing.models import PricingRule
from app.modules.sales.models import Sale, SaleLine
from app.modules.audit.models import AuditEvent

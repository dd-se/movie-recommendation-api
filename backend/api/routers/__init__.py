from .admin import router as admin_router
from .auth import router as auth_router
from .v1 import router as v1_router
from .v2 import router as v2_router

all_routers = [admin_router, auth_router, v1_router, v2_router]

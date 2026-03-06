from fastapi import FastAPI
from app.api.routes import router
from app.api.onboarding_routes import router as onboarding_router
from app.api.bootstrap_routes import router as bootstrap_router

app = FastAPI(
    title="ADCP Optimizer",
    description="Anti-Drama Co-Parenting Schedule Optimizer Service",
    version="0.2.0",
)

app.include_router(router, prefix="/solve")
app.include_router(onboarding_router, prefix="/onboarding")
app.include_router(bootstrap_router, prefix="/bootstrap")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "optimizer"}

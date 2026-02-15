from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(
    title="ADCP Optimizer",
    description="Anti-Drama Co-Parenting Schedule Optimizer Service",
    version="0.1.0",
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "optimizer"}

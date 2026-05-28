from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from backend.api import router as api_router
from backend.database.session import engine, run_lightweight_migrations
from backend.models import Base
from backend.database.session import Session
from backend.services.management import seed_default_dictionaries

app = FastAPI(title="外派员工宿舍与通勤管理系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

frontend_dist = Path("frontend/dist")
if frontend_dist.exists():
    app.mount("/ui", StaticFiles(directory=str(frontend_dist), html=True), name="ui")
else:
    @app.get("/ui", response_class=HTMLResponse)
    @app.get("/ui/{_:path}", response_class=HTMLResponse)
    def ui_not_built():
        return "<h3>Frontend not built yet. Run: cd frontend && npm install && npm run build</h3>"


@app.get("/")
def root():
    return RedirectResponse(url="/ui/")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


Base.metadata.create_all(engine)
run_lightweight_migrations()
with Session(engine) as session:
    seed_default_dictionaries(session)

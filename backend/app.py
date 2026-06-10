from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from backend.api import router as api_router
from backend.core.config import settings
from backend.database.session import engine, run_lightweight_migrations, Session
from backend.models import Base
from backend.services.management import backfill_room_items, seed_default_dictionaries

app = FastAPI(title="外派员工宿舍与通勤管理系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False if settings.cors_origins == ["*"] else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

frontend_dist = Path("frontend/dist")

if frontend_dist.exists():
    # ✅ CHANGED: 不要 mount 整个 /ui
    # 只挂载前端静态资源 assets
    app.mount(
        "/ui/assets",
        StaticFiles(directory=str(frontend_dist / "assets")),
        name="ui-assets",
    )

    # ✅ ADDED: /ui 和 /ui/ 都返回 React 首页
    @app.get("/ui", response_class=HTMLResponse)
    @app.get("/ui/", response_class=HTMLResponse)
    def serve_ui_root():
        return (frontend_dist / "index.html").read_text(encoding="utf-8")

    # ✅ ADDED: /ui/xxx 刷新时也返回 React 首页
    @app.get("/ui/{full_path:path}", response_class=HTMLResponse)
    def serve_ui_routes(full_path: str):
        return (frontend_dist / "index.html").read_text(encoding="utf-8")

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
    backfill_room_items(session)
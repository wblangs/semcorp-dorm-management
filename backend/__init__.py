# NOTE: Intentionally does NOT import `app` here.
#
# Importing the FastAPI app runs module-level startup side-effects (create_all,
# migrations, seed, backfill) that touch the database. Alembic's env.py imports
# `backend.core.config`, which would otherwise trigger those side-effects and
# query columns that a pending migration hasn't added yet (chicken-and-egg).
#
# Import the app explicitly where needed:  from backend.app import app

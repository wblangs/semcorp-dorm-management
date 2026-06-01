import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url

from backend.core.config import Settings


class MySQLSmokeTest(unittest.TestCase):
    def test_mysql_url_and_driver_are_supported(self):
        url = "mysql+pymysql://dorm_user:password@localhost:3306/dorm_management"
        settings = Settings.from_env(
            {
                "DATABASE_URL": url,
                "SECRET_KEY": "test-secret",
                "ACCESS_TOKEN_EXPIRE_MINUTES": "480",
                "APP_ENV": "TEST",
                "CORS_ORIGINS": "http://127.0.0.1:5173",
            }
        )

        parsed = make_url(settings.database_url)
        engine = create_engine(settings.database_url, future=True)

        self.assertEqual(parsed.drivername, "mysql+pymysql")
        self.assertEqual(settings.database_type, "MySQL")
        self.assertEqual(settings.app_env, "TEST")
        self.assertNotIn("password", settings.safe_database_url)
        self.assertEqual(engine.dialect.name, "mysql")


if __name__ == "__main__":
    unittest.main()

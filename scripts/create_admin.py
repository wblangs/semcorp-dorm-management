import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.auth import hash_password, normalize_username
from backend.database.session import engine, run_lightweight_migrations
from backend.models import Base, User


def configure_console_output() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="创建初始管理员账号")
    parser.add_argument("--username", required=True, help="管理员用户名")
    parser.add_argument("--password", required=True, help="管理员密码")
    parser.add_argument("--display-name", default=None, help="显示名称")
    return parser.parse_args()


def main() -> int:
    configure_console_output()
    args = parse_args()
    username = normalize_username(args.username)
    if not args.password:
        print("创建失败：密码不能为空")
        return 1

    Base.metadata.create_all(engine)
    run_lightweight_migrations()

    with Session(engine) as session:
        existing = session.scalar(
            select(User).where(User.username == username, User.is_deleted.is_(False))
        )
        if existing:
            print(f"创建失败：用户名 {username} 已存在")
            return 1

        user = User(
            username=username,
            password_hash=hash_password(args.password),
            display_name=args.display_name,
            role="admin",
            status="active",
        )
        session.add(user)
        session.commit()

    print(f"创建成功：管理员 {username} 已创建")
    return 0


if __name__ == "__main__":
    sys.exit(main())

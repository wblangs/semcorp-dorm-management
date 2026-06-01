# 外派员工宿舍、人员停留、入住分配、车辆基础档案管理系统（MVP）

当前版本：`v0.7-mysql-deployment-prep`

基于 `A1` 目录下需求文档实现的内部试用版系统，覆盖当前 MVP 的核心能力：

- 系统账号密码登录
- admin / user 两级基础权限
- 用户名登录不区分大小写
- 宿舍管理（CRUD）
- 房间管理（CRUD）
- 人员管理（CRUD）
- 人员附属签证与停留合规信息维护
- 入住分配（含业务规则校验）
- Dashboard 基础统计
- 车辆基础档案与状态维护
- SQLite 开发模式与 MySQL Community Edition 试用部署支持
- admin-only 系统信息页

当前 MVP 不包含司机管理、派车调度、接送需求、路线优化。车辆模块仅用于车辆档案维护、车辆状态维护、保险到期提醒、年检到期提醒、保养到期提醒。

## 技术栈

- FastAPI
- SQLAlchemy
- SQLite（开发模式，本地文件 `dorm_commute.db`）
- MySQL Community Edition（内部试用/未来生产准备）

## 快速启动

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
scripts/start_dev.sh
```

本地开发如果没有设置 `SECRET_KEY`，系统会使用默认开发值。该默认值仅用于本机开发，内部试用或真实环境必须改成随机长字符串。

启动后访问：

- 文档：`http://127.0.0.1:8000/docs`
- 健康检查：`http://127.0.0.1:8000/health`
- 管理台：`http://127.0.0.1:8000/`（或 `http://127.0.0.1:8000/ui/`）

## 初始管理员

首次使用前创建管理员账号：

```bash
source .venv/bin/activate
python scripts/create_admin.py --username admin --password Admin@123 --display-name 管理员
```

脚本会检查用户名是否已存在，密码只保存哈希值，不会在终端打印 `password_hash`。

登录接口：

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

当前权限：

- `admin`：可访问所有页面；可新增、编辑、删除；可维护字典；可管理用户；可查看审计日志接口。
- `user`：可访问 Dashboard、宿舍、房间、人员、停留风险、入住分配、车辆；可新增、编辑业务数据；不可删除；不可维护字典；不可管理用户。

角色字段保留为字符串，当前仅启用 `admin` / `user`，后续可扩展更细角色。

## 数据库迁移

项目使用 Alembic 管理数据库结构迁移，默认仍使用本地 SQLite 文件 `dorm_commute.db`，也支持 MySQL Community Edition。

`DATABASE_URL` 示例：

```bash
# SQLite
DATABASE_URL=sqlite:///./dorm_commute.db

# MySQL
DATABASE_URL=mysql+pymysql://dorm_user:password@localhost:3306/dorm_management
```

常用命令：

```bash
source .venv/bin/activate
alembic upgrade head
alembic current
alembic revision --autogenerate -m "describe change"
```

说明：

- `alembic/env.py` 会读取 `backend.models.Base.metadata`，可自动识别现有 SQLAlchemy models。
- 当前初始 migration 会兼容空数据库和已有 SQLite 数据库：已有表不会被重建，只会补缺失字段和新增表。
- 应用启动时仍保留 SQLite 轻量迁移兜底，方便本地 MVP 继续直接运行；MySQL 和正式结构变更应优先执行 Alembic migration。
- 如果需要切换数据库文件，可设置 `DATABASE_URL`，例如 `DATABASE_URL=sqlite:///./another.db alembic upgrade head`。
- 试用部署准备文档见 `docs/DEPLOYMENT.md`，备份建议见 `docs/BACKUP_GUIDE.md`。

## 验证

```bash
python3 -m compileall backend main.py
python3 -m compileall alembic tests
.venv/bin/python tests/backend_smoke_test.py
.venv/bin/python tests/mysql_smoke_test.py
cd frontend && npm run build
```

## 已实现 API（核心）

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET/POST/PUT /api/users`
- `POST /api/users/{user_id}/reset-password`
- `GET /api/system`
- `GET/POST/PUT/DELETE /api/dorms`
- `GET/POST/PUT/DELETE /api/rooms`
- `GET/POST/PUT/DELETE /api/people`
- `GET/POST /api/allocations`
- `POST /api/allocations/{allocation_id}/checkout`
- `GET /api/audit-logs`
- `GET /api/dictionaries`
- `PUT /api/dictionaries/{key}`
- `GET/POST /api/stay`
- `GET/POST/PUT/DELETE /api/vehicles`
- `GET /api/dashboard`
- `GET /api/alerts`（Phase 2：停留风险与合同到期提醒）

## 管理台功能

- Dashboard：宿舍/房间/床位/入住/停留风险/宿舍合同到期/车辆状态与到期提醒统计
- 宿舍：增删改查（删除会级联删除房间）
- 房间：增删改查
- 人员：增删改查，并在人员编辑中维护附属签证与停留信息
- 停留风险：风险清单页，聚焦 30 天内到期、60 天内到期、已超期、未维护最大停留日期
- 车辆：车辆档案维护、状态维护、保险/年检/保养到期提醒（不含司机管理、派车调度、路线优化）
- 字典：宿舍类型、房间类型、人员类型、部门、签证类型、车辆类型、状态等选项维护；人员部门已字典化，默认车辆类型包括 SUV、Sedan、Van、Pickup、Other
- 系统：仅 admin 可见，展示当前版本、数据库类型、系统环境、当前用户，不展示密钥、数据库密码或 token
- 入住分配：新增入住、退房（包含业务规则校验）

## 入住业务规则

创建入住分配时会校验：

1. 房间必须属于所选宿舍
2. 房间不可超员
3. 房间性别限制必须匹配人员性别（或房间为 `Any`）
4. 人员不能重复入住（仅允许一个 `active` 分配）

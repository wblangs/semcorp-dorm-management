# 开发交接文档

本文档面向后续接手的开发同事，说明当前项目状态、代码结构、运行方式、部署更新流程和开发边界。

文档基于当前实际代码整理，不包含服务器 `.env`、数据库密码、SECRET_KEY、JWT token、用户密码等敏感信息。

## 1. 项目当前状态

项目名称：外派员工宿舍、人员停留、入住分配、车辆基础档案管理系统。

当前阶段：美国本地虚拟服务器内部试用版。

当前版本：`v0.7-mysql-deployment-prep`。

代码仓库：GitHub 仓库 `wblangs/semcorp-dorm-management`。

当前部署环境：

- 部署用户：`deploy`
- 部署目录：`/opt/semcorp-dorm-management`
- 数据库：MySQL
- 配置文件：服务器本地 `.env`
- 后端端口：`8000`
- 服务建议名称：`semcorp-dorm`
- 生产启动脚本：`scripts/start_prod.sh`
- 服务器更新脚本：`scripts/update_server.sh`

当前 MVP 包含：

- 登录认证
- admin / user 两级权限
- Dashboard
- 宿舍管理
- 房间管理
- 人员管理
- 人员附属签证与停留信息
- 停留风险清单
- 入住分配与退宿
- 车辆基础档案与状态维护
- 字典维护
- 用户管理
- 系统信息页
- 审计日志 API
- SQLite 开发模式
- MySQL 试用部署支持
- Alembic 数据库迁移

当前 MVP 不包含：

- 司机管理
- 派车调度
- 接送需求
- 路线优化
- 文件上传
- 邮件通知
- HTTPS / 域名配置
- 完整双语
- 更细粒度 RBAC

## 2. 重要文档索引

| 文档 | 用途 |
| --- | --- |
| `README.md` | 项目概览、快速启动、核心 API、验证命令 |
| `docs/CURRENT_SCOPE.md` | 当前 MVP 范围与 Future Scope |
| `docs/USER_GUIDE.md` | 行政、HR、普通业务用户操作手册 |
| `docs/ADMIN_GUIDE.md` | IT 管理员手册 |
| `docs/OPERATIONS_GUIDE.md` | 部署运维手册 |
| `docs/DEPLOYMENT.md` | 部署准备说明 |
| `docs/BACKUP_GUIDE.md` | 备份建议 |
| `docs/ACCEPTANCE_CHECKLIST.md` | 验收清单 |

如果文档与代码冲突，以当前代码为准，并同步修正文档。

## 3. 技术栈

后端：

- FastAPI
- SQLAlchemy
- Alembic
- PyMySQL
- SQLite / MySQL
- 自实现 JWT 与 PBKDF2 密码哈希

前端：

- React 19
- TypeScript
- React Router
- Vite
- Tailwind CSS

测试：

- `tests/backend_smoke_test.py`
- `tests/mysql_smoke_test.py`
- 前端 TypeScript build

## 4. 目录结构

```text
.
├── backend/
│   ├── api/routes.py              # API 路由与权限依赖
│   ├── app.py                     # FastAPI app、CORS、静态前端挂载、启动初始化
│   ├── auth.py                    # 登录、JWT、密码哈希、当前用户依赖
│   ├── core/config.py             # 环境变量配置
│   ├── database/session.py        # SQLAlchemy engine/session、SQLite 轻量迁移
│   ├── models/entities.py         # SQLAlchemy models
│   ├── schemas/payloads.py        # Pydantic 请求 schema
│   └── services/management.py     # 主要业务逻辑、审计、Dashboard、字典
├── frontend/
│   ├── src/App.tsx                # 前端路由
│   ├── src/api/                   # API client
│   ├── src/auth/AuthContext.tsx   # 前端登录状态
│   ├── src/components/            # FormField、DataTable
│   ├── src/layouts/AdminLayout.tsx# 主布局与菜单
│   ├── src/pages/                 # 各业务页面
│   └── src/dictionaries.ts        # 前端默认字典
├── alembic/
│   ├── env.py
│   └── versions/                  # 数据库迁移
├── scripts/
│   ├── create_admin.py            # 创建初始管理员
│   ├── start_dev.sh               # 本地开发启动
│   ├── start_prod.sh              # 试用/生产启动
│   └── update_server.sh           # 服务器一键更新
├── tests/
│   ├── backend_smoke_test.py
│   └── mysql_smoke_test.py
└── docs/
```

## 5. 本地开发启动

首次初始化：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cd frontend
npm install
cd ..
```

启动：

```bash
scripts/start_dev.sh
```

访问：

```text
http://127.0.0.1:8000/ui/
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/health
```

创建本地管理员：

```bash
source .venv/bin/activate
python scripts/create_admin.py --username admin --password '<local-password>' --display-name 管理员
```

注意：

- 本地 `.env` 不得提交。
- 本地 SQLite 数据库文件不得提交。
- 如使用 MySQL，确保 `.env` 中的 `DATABASE_URL` 指向本地或测试库。

## 6. 环境变量

配置集中在 `backend/core/config.py`，实际值来自 `.env` 或操作系统环境变量。

当前使用的配置项：

| 配置项 | 说明 |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy 数据库连接字符串 |
| `SECRET_KEY` | JWT 签名密钥 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | token 有效期，默认 480 分钟 |
| `APP_ENV` | DEV、TEST、PROD |
| `CORS_ORIGINS` | CORS 来源 |

禁止在代码中硬编码以上配置。

## 7. 数据库与迁移

开发模式可使用 SQLite，服务器内部试用使用 MySQL。

迁移命令：

```bash
source .venv/bin/activate
alembic upgrade head
alembic current
alembic revision --autogenerate -m "describe change"
```

当前迁移文件：

- `20260528_0001_initial_schema.py`
- `20260528_0002_mvp_scope_cleanup.py`
- `20260601_0003_users_auth.py`

开发规则：

- 涉及表结构变更必须新增 Alembic migration。
- 不允许直接手改生产数据库结构。
- migration 应兼容已有数据。
- 删除业务数据优先软删除，现有核心表使用 `is_deleted`。
- 如果变更需要服务器执行 `alembic upgrade head`，交付说明必须明确写出。

## 8. 权限模型

当前仅两类角色：

| 角色 | 权限 |
| --- | --- |
| `admin` | 所有页面；新增、编辑、删除；字典维护；用户管理；系统信息；审计日志 |
| `user` | Dashboard、宿舍、房间、人员、停留风险、入住分配、车辆；可新增和编辑业务数据；不可删除；不可维护字典和用户 |

权限必须前后端同时控制：

- 前端隐藏无权限菜单和按钮。
- 后端使用 `get_current_user` 和 `require_admin` 真实校验。
- 不能只做前端隐藏。

## 9. 核心业务规则

入住分配：

- 人员、宿舍、房间必须存在且未删除。
- 房间必须属于所选宿舍。
- 房间状态为 `disabled` 时不能入住。
- 房间性别限制必须匹配人员性别，或为 `Any`。
- 房间不可超床位。
- 同一人员只能有一条 `active` 入住记录。
- `active` 入住记录不能直接删除，只能退房。
- 已退房记录不能再次退房。

删除限制：

- 删除人员时，如存在 `active` 入住记录，后端阻止。
- 删除房间时，如存在 `active` 入住记录，后端阻止。
- 删除宿舍时，如下属房间存在 `active` 入住记录，后端阻止。
- 删除接口当前仅 admin 可调用。

停留风险：

- `red`：最大停留日期已超期或 30 天内到期。
- `yellow`：31 到 60 天内到期。
- `green`：超过 60 天。
- `unknown`：未维护最大停留日期或未维护停留信息。

车辆：

- 当前只做车辆档案、状态和保险/年检/保养到期提醒。
- 不做派车调度。

## 10. 前端页面与路由

前端基路径：`/ui`。

| 路径 | 页面 | 权限 |
| --- | --- | --- |
| `/ui/login` | 登录 | 未登录 |
| `/ui/` | Dashboard | 登录用户 |
| `/ui/dorms` | 宿舍 | 登录用户 |
| `/ui/rooms` | 房间 | 登录用户 |
| `/ui/people` | 人员 | 登录用户 |
| `/ui/stay` | 停留风险 | 登录用户 |
| `/ui/allocations` | 入住分配 | 登录用户 |
| `/ui/vehicles` | 车辆 | 登录用户 |
| `/ui/dictionaries` | 字典 | admin |
| `/ui/users` | 用户管理 | admin |
| `/ui/system` | 系统 | admin |

新增页面时：

- 路由加在 `frontend/src/App.tsx`。
- 菜单加在 `frontend/src/layouts/AdminLayout.tsx`。
- API 方法加在 `frontend/src/api/index.ts`。
- 类型加在 `frontend/src/types/index.ts`。
- 保持现有 `FormField` 和 `DataTable` 风格。

## 11. API 概览

认证：

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

admin：

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/{user_id}`
- `POST /api/users/{user_id}/reset-password`
- `GET /api/system`
- `GET /api/audit-logs`
- `PUT /api/dictionaries/{key}`

业务：

- `GET/POST/PUT/DELETE /api/dorms`
- `GET/POST/PUT/DELETE /api/rooms`
- `GET/POST/PUT/DELETE /api/people`
- `GET /api/stays`
- `GET /api/stays/risks`
- `GET /api/stays/{person_id}`
- `POST /api/stays/upsert`
- `DELETE /api/stays/{stay_id}`
- `GET/POST/PUT/DELETE /api/allocations`
- `POST /api/allocations/{allocation_id}/checkout`
- `GET /api/rooms/available`
- `GET/POST/PUT/DELETE /api/vehicles`
- `GET /api/dashboard`
- `GET /api/alerts`

旧兼容接口：

- `GET /api/stay`
- `POST /api/stay`

## 12. 测试与交付前检查

每次提交前必须运行：

```bash
python3 -m compileall backend main.py
.venv/bin/python tests/backend_smoke_test.py
cd frontend && npm run build
```

如变更涉及 MySQL、配置、迁移，应额外运行或说明：

```bash
.venv/bin/python tests/mysql_smoke_test.py
alembic upgrade head
```

交付输出必须说明：

- 修改了哪些文件。
- 是否涉及数据库迁移。
- 测试结果。
- GitHub commit / push 结果。
- 服务器更新命令。
- 是否需要重启服务。
- 风险提醒。

## 13. GitHub 与服务器协作流程

代码由 Codex 或开发者维护并推送 GitHub。服务器不直接开发，只拉取 GitHub 最新代码。

本地开发完成：

```bash
git status
git add <files>
git commit -m "clear english commit message"
git push origin main
```

服务器更新：

```bash
cd /opt/semcorp-dorm-management
scripts/update_server.sh
sudo systemctl restart semcorp-dorm
sudo systemctl status semcorp-dorm
curl http://127.0.0.1:8000/health
```

如果本次只是文档更新，一般只需要：

```bash
cd /opt/semcorp-dorm-management
git status
git pull origin main
```

## 14. 服务器更新脚本说明

`scripts/update_server.sh` 会：

1. 进入 `/opt/semcorp-dorm-management`。
2. 显示当前分支和 commit。
3. 检查本地未提交改动。
4. 拉取 `origin main`。
5. 激活 `.venv`。
6. 安装 Python 依赖。
7. 执行 Alembic migration。
8. 安装前端依赖。
9. 构建前端。
10. 显示更新后的 commit。

安全设计：

- 不打印 `.env`。
- 不包含密码。
- 遇到错误立即停止。
- 不删除数据库。
- 不清空数据。
- 本地有未提交改动时停止。

## 15. 敏感信息与 Git 忽略

不得提交：

- `.env`
- `dorm_commute.db`
- `*.db`
- `*.sqlite3`
- `*.sql`
- `*.dump`
- `*.bak`
- `node_modules`
- `frontend/dist`
- 日志文件
- 任何包含密码、token、密钥的脚本或文档

如果误提交敏感信息，应立即：

1. 通知负责人。
2. 撤销或重写相关提交。
3. 轮换泄露的密码或密钥。
4. 检查 GitHub 历史记录和服务器日志。

## 16. 常见开发坑

1. `create_admin.py` 未加载 `.env`。
   可能会连到默认 SQLite，而不是服务器 MySQL。服务器执行脚本前应先加载 `.env`。

2. MySQL 密码中包含 `@`。
   `DATABASE_URL` 中必须转义为 `%40`。

3. 修改删除按钮只改前端。
   后端仍必须使用 `require_admin`。

4. 新增字段只改前端。
   需要同步 schema、model、migration、API、测试和文档。

5. 新增字典只改前端。
   需要确认后端默认字典种子逻辑也能支持。

6. 修改业务规则未更新 smoke test。
   至少更新 `tests/backend_smoke_test.py`。

7. 服务启动失败但只看浏览器。
   应先看 `systemctl status` 和 `journalctl`。

8. 文档写了未实现功能。
   禁止。必须以当前代码为准。

9. 在服务器上直接改代码。
   不推荐。应由 GitHub 管理代码，服务器只拉取。

10. 忽略 Alembic。
    表结构变更必须通过 migration，不要靠应用启动轻量迁移解决 MySQL 结构变更。

## 17. 后续建议

短期优先级：

1. 稳定内部试用。
2. 补充真实截图到文档。
3. 增加更多后端业务规则测试。
4. 为常见操作补充审计日志查询页面。
5. 改进用户密码重置流程的提示。

中期可考虑：

- 更细角色权限。
- 更完整的 MySQL 备份恢复演练。
- systemd 标准化服务文件纳入文档或模板。
- 前端错误提示统一封装。

仍不建议在当前阶段扩展：

- 司机管理
- 派车调度
- 接送需求
- 路线优化

# 管理员手册

适用对象：IT 管理员、系统管理员。

本文档以当前实际代码为准。截图位置均为占位符，后续可在试用环境补充。

## 管理员职责

管理员负责：

- 创建和维护系统用户。
- 重置用户密码。
- 维护字典配置。
- 处理登录、权限、数据库、迁移、构建和服务启动问题。
- 查看审计日志 API。
- 按 GitHub 代码版本更新服务器。

当前系统不包含司机管理、派车调度、接送需求、路线优化。

## 用户管理

菜单：`用户管理`

该菜单仅 admin 可见。

角色区别：

| 角色 | 可访问页面 | 新增/编辑业务数据 | 删除业务数据 | 字典维护 | 用户管理 | 系统信息 |
| --- | --- | --- | --- | --- | --- | --- |
| admin | 全部页面 | 可以 | 可以 | 可以 | 可以 | 可以 |
| user | Dashboard、宿舍、房间、人员、停留风险、入住分配、车辆 | 可以 | 不可以 | 不可以 | 不可以 | 不可以 |

用户字段：

| 字段 | 说明 |
| --- | --- |
| 用户名 | 登录账号，保存时会转为小写 |
| 密码 | 新增用户必填；编辑用户时填写“重置密码”才会更新 |
| 显示名 | 页面右上角显示名称 |
| 角色 | `admin` 或 `user` |
| 状态 | `active` 可登录，`disabled` 禁用 |

限制：

- 密码只保存哈希值，不保存明文。
- 用户列表不显示密码哈希。
- 禁用用户后，该用户不能登录。
- 不能禁用最后一个 `active admin`。

> 截图占位符：用户管理页面

## 创建管理员

服务器上可使用脚本创建初始管理员：

```bash
cd /opt/semcorp-dorm-management
set -a
source .env
set +a
.venv/bin/python scripts/create_admin.py --username admin --password '<密码>' --display-name 管理员
```

注意：

- 不要把真实密码写入 GitHub。
- 不要把 `.env` 内容贴到文档、聊天记录或代码提交中。
- 如果用户名已存在，脚本会提示创建失败，不会覆盖现有密码。
- 如需重置密码，优先使用“用户管理”页面。

## 字典维护

菜单：`字典`

该菜单仅 admin 可见。

当前字典：

| key | 页面名称 | 用途 |
| --- | --- | --- |
| dormTypes | 宿舍类型 | 宿舍“类型”下拉 |
| roomTypes | 房间类型 | 房间“房间类型”下拉 |
| personTypes | 人员类型 | 人员“人员类型”下拉 |
| departments | 部门 | 人员“部门”下拉 |
| visaTypes | 签证类型 | 停留信息“签证类型”下拉 |
| vehicleTypes | 车辆类型 | 车辆“车辆类型”下拉 |
| statuses | 状态 | 宿舍、房间状态下拉 |

默认字典值来自前端 `frontend/src/dictionaries.ts` 和后端默认字典种子逻辑。字典页面支持：

- 修改显示名称。
- 修改保存值。
- 新增选项。
- 删除选项。
- 恢复默认。

注意事项：

- 修改“保存值”会影响后续新数据保存值。
- 已保存的历史数据不会自动批量替换。
- 人员部门如果存在历史值且不在字典中，人员编辑页会保留当前值。
- 字典修改会写入 `audit_logs`。

> 截图占位符：字典配置页面

## 数据库配置

配置通过服务器本地 `.env` 管理，禁止提交到 GitHub。

SQLite 示例：

```env
DATABASE_URL=sqlite:///./dorm_commute.db
```

MySQL 示例：

```env
DATABASE_URL=mysql+pymysql://<db_user>:<url-encoded-password>@localhost:3306/<database_name>
```

如果密码中包含特殊字符，例如 `@`，需要在 URL 中转义为 `%40`。

其他配置：

| 配置项 | 说明 |
| --- | --- |
| SECRET_KEY | JWT 签名密钥 |
| ACCESS_TOKEN_EXPIRE_MINUTES | token 过期分钟数，默认 480 |
| APP_ENV | DEV、TEST、PROD |
| CORS_ORIGINS | 允许跨域来源 |

## 日志查看

### 服务日志

如果使用 systemd：

```bash
sudo journalctl -u semcorp-dorm -f
```

查看最近日志：

```bash
sudo journalctl -u semcorp-dorm -n 100 --no-pager
```

### 审计日志

后端已实现审计日志表 `audit_logs` 和 API：

```text
GET /api/audit-logs
GET /api/audit-logs?entity_type=person
GET /api/audit-logs?entity_type=person&entity_id=1
```

该接口仅 admin 可访问。当前没有单独审计日志前端页面。

记录范围包括：

- 宿舍新增、修改、删除
- 房间新增、修改、删除
- 人员新增、修改、删除
- 停留信息新增、修改、删除
- 入住新增、修改、退宿、删除尝试范围内的删除
- 车辆新增、修改、删除
- 字典修改
- 用户管理操作

`operator` 记录当前登录用户名。

## 升级流程

代码由 Codex 维护并推送到 GitHub。服务器更新时执行：

```bash
cd /opt/semcorp-dorm-management
scripts/update_server.sh
sudo systemctl restart semcorp-dorm
sudo systemctl status semcorp-dorm
curl http://127.0.0.1:8000/health
```

`scripts/update_server.sh` 会执行：

1. 显示当前分支和 commit。
2. 检查本地未提交改动。
3. `git pull origin main`。
4. 激活 Python 虚拟环境。
5. 安装后端依赖。
6. 执行 Alembic migration。
7. 安装前端依赖并构建。
8. 显示更新后的 commit。

如果服务器目录存在本地改动，脚本会停止，避免覆盖现场。

## 故障处理

1. 登录提示用户名或密码错误。
   确认用户是否存在、状态是否 `active`。用户名不区分大小写，密码区分大小写。

2. 登录提示用户已禁用。
   admin 进入用户管理，将状态改为 `active`。

3. 忘记 admin 密码。
   使用另一个 admin 在用户管理中重置；如没有其他 admin，需要在服务器上用脚本或数据库方式重置。

4. create_admin.py 创建成功但网页仍不能登录。
   检查执行脚本前是否加载服务器 `.env`。未加载时可能连到默认 SQLite。

5. 服务无法访问，浏览器显示连接被拒绝。
   查看 `sudo systemctl status semcorp-dorm`，如果服务退出，继续查看 journal 日志。

6. 日志显示不能连接 MySQL。
   检查 MySQL 是否启动、`.env` 中 `DATABASE_URL` 是否正确、密码特殊字符是否转义。

7. 日志显示 `Access denied`。
   检查 MySQL 用户、密码和授权。

8. 日志显示找不到 `main.py`。
   检查 systemd 的 `WorkingDirectory` 是否为 `/opt/semcorp-dorm-management`。

9. Alembic 迁移失败。
   停止升级流程，保存完整报错，不要手工改生产表结构，交由 Codex 修复 migration。

10. 前端构建失败。
    查看 `npm run build` 输出，常见原因是 TypeScript 类型错误或依赖未安装。

11. `npm` 命令不存在。
    安装 Node.js/npm 后再执行更新。

12. `pip install` 失败。
    检查虚拟环境、网络、系统编译依赖和 Python 版本。

13. `git pull` 失败提示本地改动。
    先执行 `git status` 查看变更，不要随意删除。确认无用后再由管理员处理。

14. 普通用户直接调用删除 API 返回无权限。
    这是预期行为。删除接口只允许 admin。

15. 字典保存失败。
    检查当前用户是否 admin，以及保存值是否与当前字典项冲突。

16. 人员保存提示部门不在字典选项中。
    到字典页面维护 `departments`，或选择已有部门。

17. 入住失败提示房间床位已满。
    换房间或先办理其他人员退宿。

18. 入住失败提示性别不匹配。
    检查人员性别和房间性别限制。

19. 删除宿舍、房间、人员失败。
    通常是存在 `active` 入住记录。先办理退宿再操作。

20. System 页面看不到。
    仅 admin 可见，普通 user 会被前端重定向，后端也会拒绝访问。

## 敏感信息处理

禁止提交或公开：

- `.env`
- SECRET_KEY
- DATABASE_URL 中的密码
- MySQL 密码
- JWT token
- 用户密码
- 数据库备份文件
- 日志中包含的敏感内容

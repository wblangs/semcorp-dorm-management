# MVP 验收清单

## 系统范围

- 当前系统范围：宿舍、房间、人员停留、入住分配、车辆基础档案、字典、Dashboard。
- 当前交付阶段：内部试用版，支持账号密码登录与 admin / user 两级权限。
- 当前版本：`v0.7-mysql-deployment-prep`，支持 SQLite 开发模式与 MySQL Community Edition 试用部署准备。
- 不包含：司机管理、接送需求、派车调度、路线优化。
- 车辆模块仅覆盖：车辆档案维护、车辆状态维护、保险到期提醒、年检到期提醒、保养到期提醒。

## 登录与权限验收

- 未登录访问 Dashboard、People、Vehicles 等业务页面时，自动跳转 `/login`。
- 登录页显示用户名、密码字段。
- 正确 admin 用户名密码可以登录，登录后右上角显示当前用户。
- `admin`、`Admin`、`ADMIN` 均可作为同一管理员用户名登录。
- 正确 user 用户名密码可以登录。
- 错误密码登录失败，并显示后端中文错误。
- disabled 用户不能登录，并显示后端中文错误。
- 刷新页面后可根据 token 恢复登录状态。
- 点击退出登录后 token 被清除，并跳转 `/login`。
- admin 可以看到用户管理菜单。
- user 看不到用户管理菜单和字典菜单。
- admin 可以新增用户、编辑显示名/角色/状态、重置密码、禁用用户。
- 用户列表不显示 `password_hash`。
- 禁用用户后，该用户不能再次登录。
- user 看不到删除按钮；直接调用删除 API 时，后端返回 403 或中文无权限错误。
- admin 可以删除允许删除的数据。
- admin 可以维护字典；user 直接调用字典修改 API 时返回 403 或中文无权限错误。
- user 不能访问用户管理 API。
- admin 可以看到 System 菜单；user 看不到 System 菜单。
- user 直接调用 System API 时返回 403 或中文无权限错误。
- 不能禁用或降级最后一个 active admin。

## 功能验收

- 宿舍：可新增、编辑、删除；存在 active 入住记录的下属房间时删除被阻止并显示后端中文提示。
- 房间：可新增、编辑、删除；存在 active 入住记录时删除被阻止并显示后端中文提示。
- 人员：可新增、编辑、删除；英文名非必填，列表为空时显示 `-`；存在 active 入住记录时删除被阻止。
- People 列表显示停留风险标签：red、yellow、green、未维护。
- People 列表显示当前住宿状态。
- People 编辑区可以维护 Stay 信息，新增人员时 Stay 非必填。
- `/stay` 页面定位为停留风险清单，展示 30 天内到期、60 天内到期、已超期、未维护最大停留日期。
- 停留风险清单中可快速编辑 Stay 信息；日期字段含赴美日期、计划离美日期、最大停留日期、实际离美日期。
- 入住分配：可新增、修改 active 记录、退宿；active 记录不能直接删除。
- 车辆：可新增、编辑、删除；页面不显示“所属公司”字段；删除为软删除。
- Dashboard：宿舍、房间、床位、入住、停留风险、宿舍合同到期、车辆状态、车辆保险/年检/保养到期数据联动。
- Dashboard 停留风险卡片点击后跳转 `/stay`。
- 字典：修改字典后，宿舍、房间、人员、停留、车辆页面下拉选项联动更新。
- System 页面显示当前版本、数据库类型、系统环境、当前用户。
- create_admin.py 可创建初始管理员，且用户名按小写保存。

## UI 验收

- 所有表单输入框、下拉框、日期框、文本框上方均显示中文字段名。
- 必填字段中文字段名后显示红色星号 `*`。
- 非必填字段不显示星号。
- 日期字段显示清晰中文名称：租期开始日期、租期结束日期、赴美日期、计划离美日期、最大停留日期、实际离美日期、入住日期、预计退宿日期、保险到期日、年检到期日、保养到期日。
- 新增、编辑、删除按钮风格保持一致。
- 删除前必须二次确认。
- 空数据表格显示友好提示。
- 错误提示显示后端返回的中文 detail。
- System 页面使用中文信息标签，不显示 SECRET_KEY、数据库密码、Token 等敏感配置。

## 数据验收

- 人员 `english_name` 可为空或 null。
- 车辆数据库可保留历史 `company` 列，但 API schema 和前端不再维护该字段。
- 保留字典：`dormTypes`、`roomTypes`、`personTypes`、`departments`、`visaTypes`、`vehicleTypes`、`statuses`。
- 不新增 driver 相关字典。
- `users` 表创建成功，`username` 唯一。
- `password_hash` 存储哈希值，不保存明文密码。
- 成功登录后 `last_login_at` 更新。
- `audit_logs.operator` 记录当前登录 `username`。
- 现有业务数据不丢失。
- SQLite 模式可正常启动。
- MySQL URL 使用 `mysql+pymysql`，Alembic 可读取同一 `DATABASE_URL`。
- MySQL smoke test 可验证驱动、配置解析和数据库类型识别。

## 验证命令

```bash
python3 -m compileall backend main.py
.venv/bin/python tests/backend_smoke_test.py
.venv/bin/python tests/mysql_smoke_test.py
cd frontend && npm run build
```

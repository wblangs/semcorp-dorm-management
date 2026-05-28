# 外派员工宿舍与通勤管理系统（MVP）

基于 `A1` 目录下需求文档实现的第一版后端系统，覆盖了 Phase 1 的核心能力：

- 宿舍管理（CRUD）
- 房间管理（CRUD）
- 人员管理（CRUD）
- 入住分配（含业务规则校验）
- Dashboard 基础统计
- 车辆管理（基础接口）

## 技术栈

- FastAPI
- SQLAlchemy
- SQLite（本地文件 `dorm_commute.db`）

## 快速启动

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

启动后访问：

- 文档：`http://127.0.0.1:8000/docs`
- 健康检查：`http://127.0.0.1:8000/health`
- 管理台：`http://127.0.0.1:8000/`（或 `http://127.0.0.1:8000/ui/`）

## 已实现 API（核心）

- `GET/POST/PUT/DELETE /api/dorms`
- `GET/POST/PUT/DELETE /api/rooms`
- `GET/POST/PUT/DELETE /api/people`
- `GET/POST /api/allocations`
- `POST /api/allocations/{allocation_id}/checkout`
- `GET/POST /api/stay`
- `GET/POST /api/vehicles`
- `GET /api/dashboard`
- `GET /api/alerts`（Phase 2：停留风险与合同到期提醒）

## 管理台功能

- Dashboard：宿舍/房间/床位/入住/风险/车辆基础统计
- 宿舍：增删改查（删除会级联删除房间）
- 房间：增删改查
- 人员：增删改查
- 入住分配：新增入住、退房（包含业务规则校验）

## 入住业务规则

创建入住分配时会校验：

1. 房间必须属于所选宿舍
2. 房间不可超员
3. 房间性别限制必须匹配人员性别（或房间为 `Any`）
4. 人员不能重复入住（仅允许一个 `active` 分配）

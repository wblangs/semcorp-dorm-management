# 车辆管理模块升级设计（V2）

状态：**设计定稿**——评审修订完成，全部待决事项已确认（见第 10 节决策记录），可进入 Phase 1 实施。**本文档不包含任何代码改动。**

- 目标版本：`v0.8-vehicle-v2`
- 当前基线：`f7c087e`
- 设计日期：2026-08-17（同日评审修订：提醒台账唯一键、固定值域 vs 字典、软删除唯一性、状态优先级、缓存刷新收口；附件上传已确认暂不做）

---

## 1. 现状与升级动机

### 1.1 现状

车辆能力目前只有一张表 `vehicles` 和一套 CRUD：

| 现有字段 | 说明 |
| --- | --- |
| `plate_number` | 车牌号，唯一 |
| `seat_count` | 座位数 |
| `vehicle_type` | 车辆类型（字典 `vehicleTypes`） |
| `company` | 所属公司（前端未使用） |
| `base_dorm_id` | 常驻宿舍 |
| `insurance_expire_date` | 保险到期日 |
| `inspection_expire_date` | 年检到期日 |
| `maintenance_due_date` | 保养到期日 |
| `status` | available / maintenance / disabled |
| `note` | 备注 |

Dashboard 侧有 6 个统计口径（可用/维修/停用、保险 30 天、年检 30 天、保养 30 天）。

**关键现状：车辆模块在前端已被整体注释隐藏**，导航项与路由都关掉了，后端 API 仍然存活：

- `frontend/src/layouts/AdminLayout.tsx:12` —— 导航项被注释
- `frontend/src/App.tsx:19,66` —— import 与 `<Route>` 被注释
- 线上 MySQL `vehicles` 表 0 条记录

因此本次升级**没有历史数据包袱**，可以直接按目标模型设计，不需要考虑数据兼容与回填。

### 1.2 升级动机

现有模型只能回答"这辆车什么时候到期"，无法回答实际管理中的问题：

- 这辆车保险挂在谁名下？那个人驾照过期了吗？人已经回国了吗？
- 去年这辆车修了几次、花了多少钱？
- 上次事故理赔赔下来了吗？自付了多少？
- 这辆车归哪个宿舍用？什么时候从别的宿舍调过来的？
- 租的车合同什么时候到期？

单表塞不下这些信息，需要拆成"档案 + 台账"结构。

---

## 2. 需求确认结论

| 议题 | 结论 |
| --- | --- |
| 被保险人/驾驶人档案 | **复用现有人员档案（`people`）+ 新增驾照信息**，与 `stays` 表同构 |
| 台账范围 | **保养**（费用/里程/门店）、**修理**（费用/供应商/停用时间）、**事故 + 保险理赔** |
| 保险深度 | **完整保单档案 + 续保历史** |
| 产权形式 | **混合**：自购与租赁都有，租赁车需要合同字段 |

本次**不做**：加油/油卡台账、ETC 过路费台账、租赁月费台账（用车成本类，列入 Phase 4 备选）；派车调度、路线优化、司机排班（原 PRD 已列为 Future Scope）。

---

## 3. 数据模型

### 3.1 全貌

```
people ──1:1── person_licenses            人员驾照信息（新）
   │
   └──N:M── vehicle_drivers ──┐           车辆挂保险人（新）
                              │
dorms ──N:1── vehicle_assignments ──┐     宿舍调拨历史（新）
                                    │
                                 vehicles  车辆档案（扩展）
                                    │
        ┌───────────────┬───────────┼──────────────┬────────────────┐
        │               │           │              │                │
insurance_policies  vehicle_    vehicle_    vehicle_accidents   vehicle_
   保单+续保历史(新)  maintenances  repairs      事故+理赔(新)    reminder_logs
                     保养台账(新) 修理台账(新)         │            提醒台账(新)
                                    └────────────────┘
                                     修理单可挂事故
```

### 3.2 `vehicles` 车辆档案（扩展现有表）

保留：`id` `plate_number` `seat_count` `vehicle_type` `base_dorm_id` `status` `note` + 时间戳/软删除。

新增字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `vin` | String(32), nullable | 车架号。美国车必备，唯一性在服务层校验（仅比对未删除记录，有值时生效） |
| `make` | String(50) | 品牌，如 Toyota |
| `model` | String(50) | 车型，如 Sienna |
| `model_year` | Integer | 年款 |
| `color` | String(30) | 颜色 |
| `ownership_type` | String(20) | `owned` 自购 / `leased` 租赁 |
| `purchase_date` | Date | 购置日期（自购） |
| `purchase_price` | Float | 购置金额（自购） |
| `lease_company` | String(100) | 租赁公司（租赁） |
| `lease_start_date` | Date | 合同起始（租赁） |
| `lease_end_date` | Date | 合同到期（租赁），进提醒 |
| `lease_monthly_fee` | Float | 月租金（租赁） |
| `registration_expire_date` | Date | 注册/牌照到期。美国 registration renewal 与 inspection 是两件事 |
| `odometer` | Integer | 当前里程（miles） |
| `odometer_updated_on` | Date | 里程更新日期 |
| `maintenance_interval_miles` | Integer, nullable | 保养里程间隔。留空时取主数据默认值（字典 `maintenanceIntervalDefaults`），新车表单从主数据预填，可按车覆盖 |
| `maintenance_interval_months` | Integer, nullable | 保养月数间隔，同上 |

字段改造：

| 字段 | 变化 |
| --- | --- |
| `insurance_expire_date` | 改为**派生缓存**，等于当前 active 保单的 `end_date`，由服务层写入，页面不可直接编辑 |
| `maintenance_due_date` | 改为**派生缓存**，等于上次保养推算的下次到期日 |
| `inspection_expire_date` | 保持可手工编辑 |
| `base_dorm_id` | 改为**派生缓存**，等于当前 active 调拨记录的宿舍 |
| `status` | 值域扩为 `available` 可用 / `in_repair` 在修 / `disabled` 停用 / `disposed` 已处置。`in_repair` 由修理单自动联动。**优先级：`disposed` > `disabled` > 自动联动**——手工置停用/已处置后，修理单的开单结单不再改状态，恢复可用需手工操作 |
| `company` | 删除（前端从未使用，且与 `lease_company` 语义重叠） |

> **设计说明：为什么保留冗余缓存字段。** 保险到期、保养到期、常驻宿舍完全可以从子表实时算出来，但车辆列表页要对这三列做排序、筛选和 30 天预警统计。若每次都 JOIN 子表聚合，列表和 Dashboard 都要多轮聚合查询。用服务层维护缓存字段是最省事的取舍——代价是写入路径必须集中在服务层，不能让 API 直接改这三个字段。
>
> **实现约束（评审补充）：** 缓存刷新收口成一个 `refresh_vehicle_caches(db, vehicle_id)`，对保单、保养、调拨的**任何增、改、删**之后都必须调用——只覆盖新增/续保路径不够：删除当前生效保单、修改保单到期日、删除最近一条保养记录，都会让缓存悬空。同时 `VehicleUpdate` schema 显式排除这三个派生字段，防止绕过页面从 API 直接改。
>
> **软删除与唯一性（评审补充）：** 车牌、VIN 的唯一性放在**服务层**校验且只比对 `is_deleted=False` 的记录，**不建数据库唯一索引**。否则软删除一辆车后，同车牌/同 VIN 永远无法重新录入（被软删除行占住索引）。注意现有 `vehicles.plate_number` 就是 DB 级 unique，已埋着这个雷——趁表内 0 数据，本次 migration 一并把它降级为服务层校验。

### 3.3 `person_licenses` 人员驾照信息（新，1:1 扩展 people）

结构与现有 `stays` 表完全同构（主键即 `person_id`），前端在人员编辑弹窗里加一个"驾照信息"分组即可，复用现成模式。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `person_id` | PK, FK people.id | |
| `license_number` | String(50) | 驾照号 |
| `license_state` | String(20) | 签发州（美国按州签发） |
| `license_class` | String(20) | 类别，如 Class D / CDL |
| `issue_date` | Date | 签发日期 |
| `expire_date` | Date | 到期日期，进提醒 |
| `note` | String(500) | 备注 |

### 3.4 `vehicle_drivers` 车辆挂保险人（新）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `vehicle_id` | FK vehicles.id | |
| `person_id` | FK people.id | |
| `role` | String(20) | `primary` 主要驾驶人 / `secondary` 第二驾驶人 |
| `start_date` | Date | 挂靠起始 |
| `end_date` | Date, nullable | 挂靠结束，换人时写入 |
| `status` | String(20) | `active` / `removed` |
| `note` | String(500) | |

规则：

1. 每车 `active` 挂靠人**最多 2 个**（上限做成常量 `MAX_INSURED_DRIVERS = 2`，将来放宽只改一处）
2. `primary` 最多 1 个
3. 新车可以先没有挂靠人（未上保险状态），不强制
4. 一个人**可以**挂多辆车（如需限制，做成字典开关而不是硬编码）
5. 换人不删记录：旧记录置 `removed` 并写 `end_date`，保留历史

### 3.5 `insurance_policies` 保单档案与续保历史（新）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `vehicle_id` | FK | |
| `insurer` | String(100) | 保险公司 |
| `policy_number` | String(80) | 保单号 |
| `coverage_type` | String(50) | 险种，字典 `insuranceCoverageTypes` |
| `coverage_amount` | Float | 保额 |
| `deductible` | Float | 免赔额 |
| `premium` | Float | 保费 |
| `premium_cycle` | String(20) | 缴费周期：月/半年/年 |
| `start_date` | Date | 起保日 |
| `end_date` | Date | 到期日，进提醒 |
| `driver_snapshot` | String(200) | 承保驾驶人快照（见下） |
| `status` | String(20) | `active` / `expired` / `cancelled` |
| `attachment_note` | String(255) | 保单 PDF 存放位置（暂不做上传） |
| `note` | String(500) | |

> **设计说明：为什么用 `driver_snapshot` 而不是保单-驾驶人关联表。** "保单上承保了谁"和"这辆车现在挂谁"是两个时点的同一件事。若两边都建关联表，需要同时维护两套关系，且续保时要复制一遍。取舍是：挂靠关系以 `vehicle_drivers` 为唯一权威入口，保单创建/续保时把当时的 active 挂靠人姓名快照成文本存进保单，满足"这张保单当年承保的是谁"的追溯需求。快照是只读的历史事实，不参与任何校验。

规则：

1. 同一车辆同一时间**只允许 1 个 `active` 保单**
2. 续保 = 新增一条保单，服务层自动把旧保单置 `expired`，并刷新 `vehicles.insurance_expire_date`
3. 新保单 `start_date` 早于旧保单 `end_date` 时提示日期重叠（警告，不硬拦，实际续保常有重叠日）
4. 保单删除仅 admin 可操作

### 3.6 `vehicle_maintenances` 保养台账（新）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `vehicle_id` | FK | |
| `maintenance_date` | Date | 保养日期 |
| `odometer` | Integer | 保养时里程 |
| `items` | String(255) | 保养项目，字典 `maintenanceItems` 多选后逗号拼接 |
| `vendor` | String(100) | 门店/供应商 |
| `cost` | Float | 费用 |
| `invoice_no` | String(80) | 发票号 |
| `next_due_date` | Date | 下次保养日期，默认 `maintenance_date + interval_months` |
| `next_due_mileage` | Integer | 下次保养里程，默认 `odometer + interval_miles` |
| `note` | String(500) | |

副作用（服务层）：保存后若 `odometer` 大于车辆当前里程则更新 `vehicles.odometer`；同步刷新 `vehicles.maintenance_due_date`。

### 3.7 `vehicle_repairs` 修理台账（新）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `vehicle_id` | FK | |
| `accident_id` | FK vehicle_accidents.id, nullable | 事故导致的维修可关联事故 |
| `reported_date` | Date | 报修日期 |
| `repair_start_date` | Date | 送修日期 |
| `repair_end_date` | Date | 取车日期 |
| `fault_description` | String(500) | 故障描述 |
| `repair_content` | String(500) | 维修内容 |
| `vendor` | String(100) | 修理厂 |
| `cost` | Float | 费用 |
| `paid_by` | String(20) | `company` 公司 / `insurance` 保险 / `driver` 个人 |
| `affects_availability` | Bool, 默认 true | 是否影响用车 |
| `status` | String(20) | `reported` 已报修 / `in_repair` 在修 / `done` 已完成 / `cancelled` 已取消 |
| `note` | String(500) | |

副作用（服务层）：存在 `status=in_repair` 且 `affects_availability=true` 的单子时，`vehicles.status` 自动置 `in_repair`；最后一张在修单结单后自动恢复 `available`（若车辆未被手工设为 `disabled`/`disposed`）。**停用时长** = `repair_end_date - repair_start_date`，报表里直接算，不存字段。

### 3.8 `vehicle_accidents` 事故与理赔（新）

事故与理赔放同一张表：一次事故对应一次理赔，拆两张表会让每个查询都多一次 JOIN，收益为零。

事故部分：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `vehicle_id` | FK | |
| `accident_datetime` | DateTime | 事故时间 |
| `location` | String(255) | 地点 |
| `driver_person_id` | FK people.id, nullable | 当事驾驶人 |
| `driver_name_text` | String(80) | 当事人姓名（非档案内人员时填这里） |
| `accident_type` | String(50) | 字典 `accidentTypes` |
| `liability` | String(50) | 责任判定，字典 `liabilityTypes` |
| `description` | String(1000) | 事故描述 |
| `has_injury` | Bool | 是否有人伤 |
| `injury_note` | String(500) | 伤情说明 |
| `police_report_no` | String(80) | 报案号 |
| `third_party_info` | String(500) | 对方车牌/姓名/联系方式/保险公司 |
| `estimated_loss` | Float | 定损金额 |

理赔部分：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `policy_id` | FK insurance_policies.id, nullable | 出险保单，默认取事故日期覆盖的保单 |
| `claim_no` | String(80) | 理赔案号 |
| `claim_status` | String(20) | `not_filed` 未报案 / `filed` 已报案 / `surveying` 定损中 / `approved` 已核准 / `paid` 已赔付 / `rejected` 拒赔 / `closed` 已结案 |
| `claim_amount` | Float | 索赔金额 |
| `settled_amount` | Float | 实际赔付 |
| `deductible_paid` | Float | 自付免赔额 |
| `claim_filed_date` | Date | 报案日期 |
| `claim_closed_date` | Date | 结案日期 |
| `note` | String(500) | |

### 3.9 `vehicle_assignments` 宿舍调拨历史（新）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `vehicle_id` | FK | |
| `dorm_id` | FK dorms.id | |
| `start_date` | Date | 调入日期 |
| `end_date` | Date, nullable | 调出日期 |
| `status` | String(20) | `active` / `ended` |
| `note` | String(500) | 调拨原因 |

规则：

1. 同一车辆同一时间只有 1 条 `active` 记录
2. 新调拨自动结束旧记录（旧 `end_date` = 新 `start_date`），并刷新 `vehicles.base_dorm_id`
3. **沿用现有约束**：宿舍下还有车时不允许删除宿舍（`backend/services/management.py:491`），该校验继续基于 `base_dorm_id`

> 设计说明：车辆归属宿舍本可以只用 `vehicles.base_dorm_id` 一个字段。做成历史表的理由是——人员入住已经是历史表结构（`allocations`），车辆调拨在管理上同样需要回答"这车三月份在哪个宿舍"，而加一张历史表的成本很低。

### 3.10 `vehicle_reminder_logs` 提醒台账（新）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `entity_type` | String(40) | `vehicle` / `insurance_policy` / `person_license` / `vehicle_accident` |
| `entity_id` | Integer | 业务主键 |
| `remind_kind` | String(40) | `insurance_expire` / `inspection_expire` / `registration_expire` / `maintenance_due` / `lease_expire` / `license_expire` / `claim_stalled` |
| `remind_stage` | Integer | 提前天数档位，如 30 / 15 / 7 |
| `due_target_date` | Date | **本次提醒针对的到期日**，唯一键的一部分 |
| `reminded_on` | Date | 发送日期 |

唯一约束：`(entity_type, entity_id, remind_kind, remind_stage, due_target_date)`。

> **设计说明：为什么不沿用 `utility_bills.reminded_on` 那种在业务表加字段的做法。** 一个缴费项只提醒一次，加一个字段够用。但一辆车有 6 类到期项、每类还有 30/15/7 三个提前档位，往 `vehicles` 表塞 18 个 `reminded_*` 字段不可维护。独立台账表是更干净的解法，将来水电房费提醒也可以迁移过来统一。
>
> **评审修订：唯一键必须包含 `due_target_date`。** 若唯一键只有 `(entity_type, entity_id, remind_kind, remind_stage)`，每辆车的每个提醒档位一生只能触发一次——年检续期后新到期日永远不会再提醒（旧记录挡住新提醒），"理赔超 30 天未结案每 30 天一次"的循环提醒也无法表达。加入到期日后：到期日一变自动重新武装（新日期 = 新行）；循环提醒把"下一次应提醒日"作为 `due_target_date`，每期一行。

### 3.11 字典新增与固定值域（评审修订）

**开放字典**（admin 可在字典页自由增改，不参与代码逻辑）：

| 字典 key | 标签 | 默认值 |
| --- | --- | --- |
| `vehicleTypes`（已有） | 车辆类型 | SUV / Sedan / Van / Pickup / Other |
| `insuranceCoverageTypes` | 险种 | Liability / Collision / Comprehensive / Full Coverage |
| `maintenanceItems` | 保养项目 | 换机油 / 换机油滤 / 换空气滤 / 轮胎更换 / 四轮定位 / 刹车片 / 电瓶 / 变速箱油 |
| `accidentTypes` | 事故类型 | 单方事故 / 双方碰撞 / 停车剐蹭 / 被追尾 / 车辆被撞（无人在车） / 其他 |
| `liabilityTypes` | 责任判定 | 全责 / 主要责任 / 同等责任 / 次要责任 / 无责 / 待定 |
| `vehicleVendors` | 车辆供应商 | （空，由使用中积累） |
| `maintenanceIntervalDefaults` | 保养间隔默认值 | `miles`=5000、`months`=6。**主数据**：admin 在字典页维护，新车表单预填，每辆车可单独覆盖。字典值是字符串，服务层解析为整数，解析失败回退 5000/6 |

**固定值域**（前后端常量维护，**不进字典**）：

| 值集 | 值 |
| --- | --- |
| 车辆状态 | `available` / `in_repair` / `disabled` / `disposed` |
| 修理单状态 | `reported` / `in_repair` / `done` / `cancelled` |
| 理赔状态 | `not_filed` / `filed` / `surveying` / `approved` / `paid` / `rejected` / `closed` |
| 费用承担方 | `company` / `insurance` / `driver` |
| 挂靠角色 | `primary` / `secondary` |
| 产权形式 | `owned` / `leased` |

> **评审修订：为什么这些不做成字典。** 这些值直接参与代码逻辑——车辆状态的自动联动与优先级、理赔进度条的步骤顺序、费用承担方的统计口径。做成可编辑字典意味着 admin 在字典页改一个 value 就能静默破坏这些逻辑。中文标签在前端常量里翻译（现状 `VehiclesPage.tsx:34` 就是这么做的，保持不变，只扩充值集）。

---

## 4. 业务规则清单

| # | 规则 | 强度 |
| --- | --- | --- |
| 1 | 车牌号唯一 | 硬校验（已有） |
| 2 | VIN 有值时唯一 | 硬校验 |
| 3 | 每车 active 挂靠人 ≤ 2，primary ≤ 1 | 硬校验 |
| 4 | 挂靠人驾照缺失或已过期 | **警告放行**（已确认）：驾照信息常晚于挂靠录入，硬拦会死锁；同时进 Dashboard 提醒 |
| 5 | 挂靠人已离场（`stays.actual_leave_date` 已过） | 警告 + Dashboard 提示"需更换被保险人" |
| 6 | 同车同时间仅 1 个 active 保单 | 硬校验 |
| 7 | 新旧保单日期重叠 | 警告放行 |
| 8 | 实际赔付 > 定损金额 | 警告放行 |
| 9 | 新录里程小于车辆当前里程 | 二次确认（可能是换表或录错） |
| 10 | 宿舍下有车时不可删除宿舍 | 硬校验（已有） |
| 11 | 车辆有 active 保单或在修单时删除 | 二次确认 |
| 12 | 车辆删除 | 软删除（沿用 `is_deleted`） |
| 13 | 所有增删改写入 `audit_logs` | 沿用现有 `_audit()` |
| 14 | 车辆状态优先级 `disposed` > `disabled` > 自动联动：手工停用/处置后修理单联动不改状态 | 硬规则 |
| 15 | 保单/保养/调拨的任何增改删后必须调用 `refresh_vehicle_caches()` 刷新派生字段 | 实现约束 |
| 16 | 车牌/VIN 唯一性在服务层校验，仅比对未删除记录，不建 DB 唯一索引 | 硬校验 |


---

## 5. 到期提醒

复用现有钉钉工作通知机制（`backend/app.py` 的 30 分钟轮询线程 + 9 点后发送 + 幂等台账）。

| 提醒项 | 提前档位 |
| --- | --- |
| 保险到期 | 30 / 15 / 7 天 |
| 年检到期 | 30 / 7 天 |
| 注册到期 | 30 / 7 天 |
| 保养到期 | 15 天，或里程达到间隔的 90% |
| 租赁合同到期 | 60 / 30 天 |
| 挂靠人驾照到期 | 30 / 7 天 |
| 理赔超 30 天未结案 | 每 30 天一次 |

**接收人**（已确认，与水电缴费提醒分开）：在 `users` 表新增 `receive_vehicle_reminders` 开关，与现有 `receive_bill_reminders` 并列，用户管理页面加一列勾选。车辆管理人和水电缴费人不是同一批人，两个开关互不影响。

消息形态沿用缴费提醒的纯文本工作通知：

```
【车辆到期提醒】
· ABC-1234（Toyota Sienna，1号宿舍）保险 2026-09-15 到期（29 天后）
· XYZ-8899（Honda Odyssey，2号宿舍）保养 2026-08-30 到期（13 天后），当前里程 48,200
请及时处理。
```

---

## 6. API 设计

沿用现有 `/api/` 风格与 `require_editor` / `require_admin` 依赖。

### 车辆档案

```
GET    /api/vehicles                    列表（含聚合：挂靠人姓名、到期徽标、在修标记）
GET    /api/vehicles/{id}               详情（含挂靠人、当前保单、最近台账摘要）
POST   /api/vehicles                    新增
PUT    /api/vehicles/{id}               修改
DELETE /api/vehicles/{id}               软删除
PUT    /api/vehicles/{id}/odometer      更新里程
```

### 挂靠人与驾照

```
GET    /api/vehicles/{id}/drivers       挂靠人（含历史）
POST   /api/vehicles/{id}/drivers       新增挂靠
PUT    /api/vehicle-drivers/{did}       修改
DELETE /api/vehicle-drivers/{did}       解除挂靠（置 removed）
GET    /api/people/{pid}/license        驾照信息
POST   /api/people/{pid}/license        新增或更新（upsert，对齐现有 /api/stays/upsert）
```

### 台账

```
GET/POST      /api/vehicles/{id}/policies         保单与续保
PUT/DELETE    /api/insurance-policies/{pid}
GET/POST      /api/vehicles/{id}/maintenances     保养
PUT/DELETE    /api/vehicle-maintenances/{mid}
GET/POST      /api/vehicles/{id}/repairs          修理
PUT/DELETE    /api/vehicle-repairs/{rid}
GET/POST      /api/vehicles/{id}/accidents        事故与理赔
PUT/DELETE    /api/vehicle-accidents/{aid}
```

### 调拨、提醒、报表

```
GET    /api/vehicles/{id}/assignments    调拨历史
POST   /api/vehicles/{id}/assign         调拨到宿舍
GET    /api/vehicles/alerts              到期提醒汇总（供提醒页与 Dashboard）
GET    /api/vehicles/summary             车辆汇总（按宿舍/按成本）
POST   /api/vehicles/reminders/test      测试发送（对齐现有缴费测试接口）
```

Dashboard 新增统计口径：`vehiclesInRepair`、`vehicleRegistrationExpiring30`、`vehicleLeaseExpiring60`、`driverLicenseExpiring30`、`openClaims`。

实现注意（评审补充）：

1. `GET /api/vehicles/alerts`、`GET /api/vehicles/summary`、`GET /api/vehicles/backup` 等静态路径必须**注册在 `GET /api/vehicles/{id}` 之前**——FastAPI 按声明顺序匹配，反了会把 `alerts` 当作 id 解析返回 422。
2. `VehicleUpdate` schema 不包含 `insurance_expire_date`、`maintenance_due_date`、`base_dorm_id` 三个派生字段（见 3.2 实现约束）。

---

## 7. 权限

| 能力 | user | admin |
| --- | --- | --- |
| 查看车辆列表与详情 | ✅ | ✅ |
| 新增/编辑车辆档案 | ✅ | ✅ |
| 新增/编辑保养、修理、事故记录 | ✅ | ✅ |
| 管理保单（新增/续保/删除） | ❌ | ✅ |
| 挂靠人增减 | ❌ | ✅ |
| 宿舍调拨 | ✅ | ✅ |
| 删除任何记录 | ❌ | ✅ |
| 字典维护 | ❌ | ✅ |

费用类字段（保费、修理费、赔付金额、月租金、购置金额）**对 `user` 角色不隐藏**（已确认），所有登录用户可见，不引入额外开关。

---

## 8. 页面设计

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 车辆列表 | `/vehicles` | 搜索 + 状态/宿舍筛选，到期日带颜色徽标，点车牌进详情 |
| 车辆详情 | `/vehicles/:id` | 顶部车辆概览卡 + 7 个 Tab（档案/挂靠人/保险/保养/修理/事故理赔/调拨） |
| 车辆提醒 | `/vehicle-alerts` | 按到期类型分组的清单页，样式对齐现有"停留风险"页 |
| Dashboard | `/` | 新增车辆区块，卡片可点击跳转（沿用现有模式） |
| 人员编辑 | `/people` | 弹窗内新增"驾照信息"分组 |

**必须一并恢复**：`AdminLayout.tsx` 导航项、`App.tsx` 的 import 与 `<Route>`，并新增详情页与提醒页路由。

到期徽标配色（沿用现有 Tailwind 语义色）：

- 已过期 → `rose`（红）
- 30 天内到期 → `amber`（橙）
- 正常 → `slate`（灰）/ `emerald`（绿）

原型见同目录 HTML 原型稿。

---

## 9. 实施分期

| 阶段 | 内容 | 交付判据 |
| --- | --- | --- |
| **Phase 1** 基础档案 | `vehicles` 扩展、`person_licenses`、`vehicle_drivers`、`vehicle_assignments`、字典、恢复导航与路由、列表页 + 详情页骨架 | 能录入一辆完整车辆并挂 2 个人，能调拨到宿舍 |
| **Phase 2** 台账 | `insurance_policies`、`vehicle_maintenances`、`vehicle_repairs` + 状态联动 + 缓存字段刷新 | 能续保、能记保养并自动推下次到期、在修车辆状态自动变更 |
| | Phase 1→2 过渡：Phase 1 期间 `insurance_expire_date`、`maintenance_due_date` 保持手工编辑（保单/保养表尚不存在）；Phase 2 上线时切换为派生字段，对"有手工到期日但无保单记录"的车辆在列表页提示补录 | |
| **Phase 3** 事故与提醒 | `vehicle_accidents`、`vehicle_reminder_logs`、钉钉提醒、Dashboard 卡片、提醒页 | 事故理赔全流程可记录，钉钉能收到到期提醒 |
| **Phase 4** 可选 | 附件上传、成本报表、加油/ETC/租赁月费台账、Excel 导入导出 | 按需 |

每个 Phase 一个 Alembic migration，沿用现有 `alembic/versions/YYYYMMDD_00NN_*.py` 命名。

---

## 10. 决策记录

全部事项已于 2026-08-17 确认，无遗留待决项：

| # | 事项 | 决策 | 落点 |
| --- | --- | --- | --- |
| 1 | 附件上传 | **暂不做**。保单 PDF、事故照片、维修发票用 `attachment_note` 文本字段记录存放位置；将来要做时新增附件表 + 上传接口，不动现有字段，届时同步调整备份策略 | §3.5 |
| 2 | 挂靠人驾照缺失/过期 | **警告放行**，同时进 Dashboard 与提醒页 | §4 规则 4 |
| 3 | 费用字段对 `user` 角色 | **不隐藏**，所有登录用户可见 | §7 |
| 4 | 车辆提醒接收人 | **与水电缴费提醒分开**，`users` 表新增 `receive_vehicle_reminders` 开关 | §5 |
| 5 | 年检与注册 | **分开维护**：`inspection_expire_date` 与 `registration_expire_date` 两个字段、两类提醒 | §3.2、§5 |
| 6 | 保养间隔默认值 | **做主数据维护**：默认值放字典 `maintenanceIntervalDefaults`（miles=5000、months=6），admin 可改；新车表单预填，每辆车可单独覆盖 | §3.2、§3.11 |

---

## 11. 明确不在本次范围

- 派车调度、接送需求、路线优化、司机排班（原 PRD Future Scope）
- 加油/油卡、ETC 过路费、租赁月费台账（Phase 4 备选）
- 车辆借还/钥匙管理
- 车辆定位与轨迹

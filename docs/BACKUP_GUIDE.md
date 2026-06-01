# 备份建议

当前阶段不实现自动备份，建议使用虚拟机快照和数据库导出两类方式。

## 1. 虚拟机快照

适用场景：

- 内部试用服务器
- 版本升级前
- 数据库迁移前
- 批量导入或清理数据前

建议：

- 每次重要发布前创建快照。
- 快照名称包含日期和版本，例如 `2026-06-01-v0.7-before-upgrade`。
- 定期删除过旧快照，避免占满磁盘。

## 2. 数据库导出

SQLite 开发模式：

```bash
cp dorm_commute.db backups/dorm_commute-$(date +%F).db
```

MySQL 试用模式：

```bash
mysqldump -u dorm_user -p dorm_management > backups/dorm_management-$(date +%F).sql
```

恢复 MySQL 示例：

```bash
mysql -u dorm_user -p dorm_management < backups/dorm_management-YYYY-MM-DD.sql
```

## 建议频率

- 内部试用期：每周至少一次数据库导出。
- 每次版本升级前：先做虚拟机快照，再导出数据库。
- 每次迁移前：确认备份文件可读取。

## 注意事项

- 备份文件不要提交到 GitHub。
- 备份文件可能包含人员和住宿信息，请限制访问权限。
- 数据库密码不要写入备份文件名或提交记录。

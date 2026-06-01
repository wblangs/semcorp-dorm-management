# 本地虚拟服务器部署准备

本文档面向内部试用版部署，不包含 HTTPS、域名、邮件通知、司机、派车、接送需求或路线相关能力。

## 服务器要求

推荐系统：Ubuntu 22.04 LTS

最低配置：

- 2 CPU
- 4 GB RAM
- 50 GB SSD

## 软件安装

安装 Python、Node.js、MySQL Community Edition：

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm mysql-server
```

Node.js 建议使用当前 LTS 版本。若系统源版本过旧，可改用 NodeSource 或 nvm。

## 数据库初始化

登录 MySQL：

```bash
sudo mysql
```

创建数据库、用户并授权：

```sql
CREATE DATABASE dorm_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dorm_user'@'localhost' IDENTIFIED BY 'change-this-password';
GRANT ALL PRIVILEGES ON dorm_management.* TO 'dorm_user'@'localhost';
FLUSH PRIVILEGES;
```

## 环境变量配置

复制环境变量模板：

```bash
cp .env.example .env
```

试用环境 `.env` 示例：

```bash
APP_ENV=TEST
DATABASE_URL=mysql+pymysql://dorm_user:change-this-password@localhost:3306/dorm_management
SECRET_KEY=replace-with-a-long-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=480
CORS_ORIGINS=http://server-lan-ip:8000
```

说明：

- `DEV`：开发电脑，本地 SQLite 或 Vite 调试。
- `TEST`：内部试用服务器，建议 MySQL。
- `PROD`：未来生产环境，必须使用强 `SECRET_KEY` 和正式备份策略。

不要把 `.env` 提交到 GitHub。

## 后端依赖

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Alembic 迁移

确认 `.env` 中 `DATABASE_URL` 指向目标数据库后执行：

```bash
source .venv/bin/activate
alembic upgrade head
alembic current
```

SQLite 开发模式仍可使用：

```bash
DATABASE_URL=sqlite:///./dorm_commute.db alembic upgrade head
```

MySQL 试用模式使用：

```bash
DATABASE_URL=mysql+pymysql://dorm_user:change-this-password@localhost:3306/dorm_management alembic upgrade head
```

## 创建管理员

```bash
source .venv/bin/activate
python scripts/create_admin.py --username admin --password Admin@123 --display-name 管理员
```

用户名会按小写保存；密码只保存哈希值。

## 前端构建

```bash
cd frontend
npm install
npm run build
cd ..
```

## 后端启动

试用环境可使用：

```bash
scripts/start_prod.sh
```

也可以手动启动：

```bash
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 内网访问

同一局域网内访问：

```text
http://server-lan-ip:8000/ui/
```

请确保服务器防火墙允许内网访问 8000 端口。

## 路由器端口映射访问

如需要从办公室外访问，可在路由器上将外部端口映射到服务器 `8000` 端口。

注意事项：

- 本阶段未配置 HTTPS，不建议直接暴露公网。
- 不要使用弱密码。
- 不要在页面、日志或文档中暴露 `SECRET_KEY`、数据库密码或 token。
- 推荐先通过 VPN 或内网访问试用。

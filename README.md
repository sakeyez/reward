# Reward

AI 学习打卡与积分奖励系统。

## 当前状态

当前项目包含一个前端静态原型和一个 FastAPI 后端：

- `frontend/`: Vite + React + TypeScript 用户端
- `backend/`: FastAPI 后端，已支持认证、打卡、积分、奖励和兑换
- `backend/uploads/`: 文件上传目录

## 创建虚拟环境

```powershell
python -m venv .venv
```

如果当前 `python` 缺少 `venv` 模块，可以使用 Windows Python Launcher：

```powershell
py -m venv .venv
```

## 安装依赖

不需要先激活虚拟环境，直接使用虚拟环境中的 Python：

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

## 启动后端

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload
```

启动后可访问：

- API 健康检查: `http://127.0.0.1:8000/api/health`
- Swagger 文档: `http://127.0.0.1:8000/docs`

## 初始化奖励数据

```powershell
.\.venv\Scripts\python.exe backend\seed.py
```

这个脚本可以重复运行，会初始化或更新 6 个积分商城奖励。

同时会初始化开发管理员账号：

- 用户名: `admin`
- 密码: `admin123456`
- 角色: `admin`

## 启动 React 前端

首次启动前安装前端依赖：

```powershell
cd frontend
npm install
```

启动 Vite 开发服务器：

```powershell
npm run dev
```

默认访问：

- React 前端: `http://127.0.0.1:5173`
- 管理员工作台: `http://127.0.0.1:5173/admin`
- 后端 API: `http://127.0.0.1:8000`

开发环境中，Vite 会把 `/api` 和 `/uploads` 代理到 `http://127.0.0.1:8000`。如需改用其它 API 地址，可以设置前端环境变量 `VITE_API_BASE_URL`。

## 已实现 API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/token`（Swagger Authorize 使用）
- `GET /api/users/me`
- `POST /api/checkins`
- `GET /api/checkins/me`
- `GET /api/checkins/calendar`
- `GET /api/checkins/{checkin_id}`
- `GET /api/points/me`
- `GET /api/rewards`
- `POST /api/redemptions`
- `GET /api/redemptions/me`

## 数据库迁移

生成迁移文件：

```powershell
.\.venv\Scripts\python.exe -m alembic -c backend\alembic.ini revision --autogenerate -m "initial schema"
```

执行迁移：

```powershell
.\.venv\Scripts\python.exe -m alembic -c backend\alembic.ini upgrade head
```

## 前后端联调流程

1. 启动后端：`.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload`
2. 初始化奖励：`.\.venv\Scripts\python.exe backend\seed.py`
3. 启动前端：`cd frontend && npm run dev`
4. 打开 `http://127.0.0.1:5173`
5. 注册或登录后，可以提交文字/图片打卡、查看日历积分、进入商城兑换奖励。

## 管理员工作台

访问 `http://127.0.0.1:5173/admin`，使用 `admin / admin123456` 登录。

第一版管理端支持：

- 运营概览：用户、今日打卡、积分、待处理兑换、奖励数量
- 用户管理：搜索用户、启用/禁用、手动加减积分
- 打卡记录：查看所有用户打卡、分数、AI 评价
- 积分流水：查看打卡奖励、兑换消耗、管理员调整、退款
- 奖励管理：新增、编辑、上下架奖励
- 兑换处理：将待处理订单标记为完成，或取消并自动退款/恢复库存

## 后端冒烟测试

```powershell
.\.venv\Scripts\python.exe backend\smoke_test.py
```

脚本会在 `8010` 端口临时启动后端，验证注册、打卡、积分、奖励查询和兑换流程。

## 后续开发计划

- 接入上传、AI 识别或 OpenAI API 能力
- 增加更细粒度的管理端权限、格式化、配置管理和部署脚本

## 后端设计文档

- 数据模型与业务规则设计: `backend/DATA_MODEL.md`

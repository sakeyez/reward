# Reward

AI 学习打卡与积分奖励系统。

## 当前状态

当前项目包含一个前端静态原型和一个 FastAPI 后端骨架：

- `frontend/`: 现有纯前端静态 Demo
- `backend/`: FastAPI 后端基础结构
- `backend/uploads/`: 后续文件上传目录

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

## 打开前端页面

直接用浏览器打开：

```powershell
Start-Process .\frontend\index.html
```

也可以后续接入前端构建工具或由后端统一托管静态资源。

## 后续开发计划

- 设计学习打卡、积分、奖励兑换等核心数据模型
- 建立数据库连接、迁移和初始化脚本
- 拆分 API 路由、服务层和 schema
- 接入上传、AI 识别或 OpenAI API 能力
- 将前端原型改造成可维护的工程化前端应用
- 增加测试、格式化、配置管理和部署脚本

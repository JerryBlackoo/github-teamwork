# 任务 Issue 与 Project 流程

本文说明如何把任务发布为 GitHub Issue，并同步到 GitHub Project。

## 核心边界

- GitHub Issue / Project 是团队公开任务派发和追踪载体。
- 本地 AI task / Trellis PRD / journal 只用于本地开发上下文，不用于公开任务派发。
- 发布 GitHub 任务时，不需要创建本地 AI task。
- 远端 issue 已进入 `In Progress`、`Review`、`Done` 或已有 assignee 时，不要用本地草稿覆盖它。

## 编号前缀

默认编号：

| 前缀 | Group | 典型范围 |
| --- | --- | --- |
| `P-*` | `Product` | 需求、产品决策、验收口径。 |
| `B-*` | `Backend` | 后端服务、数据库、接口、业务逻辑。 |
| `F-*` | `Frontend` | 前端页面、路由、状态、API client。 |
| `D-*` | `DevOps` | CI/CD、部署、本地环境、脚本、基础设施。 |
| `Q-*` | `QA` | 测试计划、测试报告、自动化测试、回归验证。 |
| `S-*` | `Special` | 跨组专项、安全、架构、契约决策。 |

标题格式：

```text
[F-001] 实现登录页面
[B-004] 补齐会话过期处理
[Q-002] 执行权限边界回归测试
```

## 任务正文最低要求

使用 [.github/ISSUE_TEMPLATE/task_issue.md](../../.github/ISSUE_TEMPLATE/task_issue.md)。

必须包含：

- 状态。
- 主责小组。
- 优先级。
- 批次。
- 模块。
- 预期工时。
- 实际工时。
- Risk。
- 依赖任务。
- 阻塞任务。
- 并行任务。
- GitHub Project。
- 权威依据。
- 任务范围。
- 交付物。
- 验收标准。
- 边界与不做内容。
- PR 要求。

## 初始状态

普通可认领任务：

```markdown
- 状态：`Ready`
- Risk：`Normal`
- 预期工时（小时数）：`1`
- 实际工时（小时数）：`0`
- GitHub Project：`Team Project`
```

需要进一步确认：

```markdown
- 状态：`Draft`
- Risk：`Needs Decision`
```

被依赖阻塞：

```markdown
- 状态：`Blocked`
- Risk：`Blocked`
```

## 工时规则

- 工时只填写数字，不带单位。
- 允许整数和小数，例如 `0`、`0.5`、`1.25`。
- 非 `Draft` 任务的预期工时必须大于 `0`。
- 实际工时初始可为 `0`。
- 关闭任务前应通过 issue 正文或评论命令确认实际工时；自动化不会用预期工时伪造实际工时。
- 维护者、协作者或当前 assignee 可评论 `实际工时：2` 手动更新。

## 依赖规则

- `依赖任务`：当前任务开始前必须完成或稳定输出的上游任务。
- `阻塞任务`：当前任务完成后会解锁的下游任务。
- `并行任务`：可以并行推进，但需要同步契约或实现边界的任务。
- `依赖原因`：写具体接口、schema、环境、权限、服务能力或验收条件。

优先使用 GitHub issue 引用：

```text
#12 #13
```

没有依赖时写：

```text
无
```

## 发布顺序

1. 先发布架构、契约、环境、CI 等上游任务。
2. 再发布后端和前端实现任务。
3. 再发布联调、测试和验收任务。
4. 下游任务创建后，回到上游任务补 `阻塞任务`。
5. 如果出现循环依赖，拆出更小的专项决策任务。

## Project 同步

`Task Issue Sync` 在 issue 创建、编辑、重新打开、关闭时运行。

识别条件：

- Issue 作者是仓库 `OWNER`、`MEMBER` 或 `COLLABORATOR`；外部用户创建的相似 Issue 不会写入内部 Project。
- 标题匹配 `[P-001] ...` 等标准编号。
- 正文包含 `GitHub Project：Team Project`，或你配置的 Project 名称。
- 正文包含可解析的任务字段。

自动动作：

| 动作 | 来源 |
| --- | --- |
| 加入 Project | Issue 标题和 Project marker。 |
| 同步 Status | Issue `状态` 和 issue open/closed 状态。 |
| 同步 Group | 标题编号前缀。 |
| 同步 Priority / Batch / Module / Risk | Issue 正文字段。 |
| 同步 ExpectedHours / ActualHours | Issue 工时字段。 |
| 同步 Dependency | Issue `依赖任务`。 |
| 收敛 label | 添加当前主责小组和模块 label，并移除旧的受管小组/模块 label。 |

如果 `Task Issue Sync` workflow 失败，维护者检查：

- Project 字段是否存在。
- `PROJECTS_TOKEN` 是否能访问 Project。
- Project name、owner、number 是否正确。
- Issue 正文字段是否保留模板格式。
- Workflow run 中报告的具体字段、权限或 API 错误。

## 认领

成员在 issue 评论：

```text
认领：@your-github-login
```

自动化会：

- 校验只能认领自己。
- 拒绝已被其他人认领的任务。
- 拒绝 `Blocked`、`Review`、`Done` 状态任务。
- 校验预期工时大于 `0`。
- 设置 assignee。
- 把状态改为 `In Progress`。
- 同步 Project。

## 测试任务

`Q-*` 测试任务使用 [.github/ISSUE_TEMPLATE/test_task_issue.md](../../.github/ISSUE_TEMPLATE/test_task_issue.md)。

测试任务必须实际运行测试并留下证据。复杂测试必须按 [../testing/templates/test-report-template.md](../testing/templates/test-report-template.md) 生成报告。

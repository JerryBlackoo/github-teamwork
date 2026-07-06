# GitHub 仓库设置

本文面向仓库维护者，说明如何把这个模板接入一个新的 GitHub 项目。

## 推荐 label

```text
team:product
team:backend
team:frontend
team:devops
team:qa
team:special
area:frontend
area:backend
area:devops
area:testing
area:docs
ci
blocked
security
needs-decision
```

创建 label 示例：

```bash
gh label create "team:frontend" --color 1d76db --description "Frontend group"
gh label create "area:backend" --color 5319e7 --description "Backend area"
gh label create blocked --color b60205 --description "Blocked by dependency or decision"
```

## GitHub Project

默认 Project 名称：

```text
Team Project
```

你可以通过 GitHub Actions Variables 修改：

| Variable | 默认值 | 说明 |
| --- | --- | --- |
| `PROJECT_OWNER` | 仓库 owner | Project 所属用户或组织 login。 |
| `PROJECT_OWNER_TYPE` | `user` | `user` 或 `organization`。 |
| `PROJECT_NUMBER` | `1` | Project v2 编号。 |
| `PROJECT_NAME` | `Team Project` | Project 标题，用于 issue marker。 |

Project 建议字段：

| 字段 | 类型 | 选项或说明 |
| --- | --- | --- |
| `Status` | Single select | `Todo`, `In Progress`, `Done` |
| `Group` | Single select | `Product`, `Backend`, `Frontend`, `DevOps`, `QA`, `Special` |
| `Priority` | Single select | `P0`, `P1`, `P2` |
| `Batch` | Single select | `Batch 0`, `Batch 1`, `Batch 2`, `Batch 3` |
| `Module` | Single select | 按项目模块设置，例如 `frontend`, `api`, `infra`, `docs` |
| `Risk` | Single select | `Normal`, `Needs Decision`, `Blocked` |
| `Dependency` | Text | 上游 issue 引用或说明。 |
| `ExpectedHours` | Number | 预期工时。 |
| `ActualHours` | Number | 实际工时。 |
| `OwnerNote` | Text | 自动化写入的来源说明。 |

## Secrets

在 `Settings -> Secrets and variables -> Actions -> Secrets` 添加：

| Secret | 用途 |
| --- | --- |
| `PROJECTS_TOKEN` | 可选。访问 user-level 或 organization Project v2 的 token。 |
| `OPENAI_API_KEY` | 可选。Codex PR Review 调用上游模型服务的 token。 |

`PROJECTS_TOKEN` 应使用 fine-grained token 或 classic token，并授予目标 Project 读写权限。Issue 评论、label 和 assignee 仍由 GitHub 自动提供的 `GITHUB_TOKEN` 处理。

## Variables

在 `Settings -> Secrets and variables -> Actions -> Variables` 添加：

| Variable | 用途 |
| --- | --- |
| `PROJECT_OWNER` | Project owner login。 |
| `PROJECT_OWNER_TYPE` | `user` 或 `organization`。 |
| `PROJECT_NUMBER` | Project 编号。 |
| `PROJECT_NAME` | Project 标题，默认 `Team Project`。 |
| `OPENAI_RESPONSES_API_ENDPOINT` | Codex review 的 Responses API endpoint。 |

## Codex PR Review

Codex review 由 [.github/workflows/codex-pr-review.yml](../../.github/workflows/codex-pr-review.yml) 配置。

必要配置：

```text
Secret:   OPENAI_API_KEY
Variable: OPENAI_RESPONSES_API_ENDPOINT
```

官方 OpenAI endpoint 通常是：

```text
https://api.openai.com/v1/responses
```

如果使用自建网关，它必须兼容 OpenAI Responses API，并支持 `openai/codex-action@v1` 实际使用的请求和响应格式。只支持旧 `/v1/chat/completions` 通常不够。

## develop 分支保护

建议在 GitHub 仓库页面设置：

- Require a pull request before merging.
- Require approvals，至少 1 人。
- Require status checks to pass before merging。
- Require branches to be up to date before merging。
- Restrict who can push to matching branches。
- 根据团队政策决定是否 Include administrators。

建议 required checks：

- `PR Guard`
- `Commitlint`
- 项目自己的 CI，例如 frontend/backend/test/deploy checks

`Auto Label` 不建议作为 required check，它是辅助自动化。

## main 分支保护

`main` 不接收日常开发 PR。建议：

- 只允许维护者或发布机器人更新。
- Require linear history。
- Require status checks before updating。
- 发布由维护者从 `develop` 合并或通过 release workflow 完成。

## Workflow 权限原则

- 只读检查使用 `contents: read`。
- 打 label 或评论 PR 需要 `issues: write` 或 `pull-requests: write`。
- 不依赖 GitHub 默认 token 权限。
- 不给读文件的 workflow 添加写权限。
- `pull_request_target` workflow 不执行 PR 分支代码。

# 文档维护工作流

本文定义文档内容应该放在哪里，避免不同文档重复维护、互相冲突。

## 文档归属

| 内容类型 | 推荐位置 |
| --- | --- |
| 仓库协作规则、分支、PR、提交、合并 | `CONTRIBUTING.md`, `docs/collaboration/` |
| GitHub Project、Issue、label、branch protection | `docs/collaboration/repository-setup.md` |
| 任务发布、认领、工时、依赖 | `docs/collaboration/task-issue-project-workflow.md` |
| 文档归属规则 | `docs/collaboration/documentation-workflow.md` |
| 测试策略、证据、报告 | `docs/testing/` |
| 服务边界、跨组契约 | `docs/architecture/` |
| 具体服务能力和实现状态 | `docs/services/<service>/`，如果项目有服务目录 |
| AI agent 工作规则 | `AGENTS.md`, `docs/collaboration/agent-workflow.md` |

## 判断原则

1. 契约优先。已确认的 API、服务边界、权限和验收语义是协作契约。
2. `develop` 是当前实现事实。open PR、草案和未合入 issue 不能写成已实现。
3. README 负责入口，不承载所有细节。
4. 服务文档只写服务特有内容，不重复仓库级流程。
5. 测试报告只记录真实执行结果，未运行不能写成通过。

## 文档和代码不一致时

- 代码偏离已确认契约时，默认修代码。
- 契约本身需要变更时，先记录决策，再改契约。
- 实现状态文档落后时，更新实现状态文档。
- 设计目标尚未落地时，标为 `pending`、`not implemented` 或 `follow-up`。

## 改动类型和必须检查

| 改动类型 | 必须检查 |
| --- | --- |
| 协作流程变化 | `CONTRIBUTING.md`, `docs/collaboration/`, `.github/workflows/` |
| Issue 模板变化 | issue 模板、Task Sync/Claim workflow、Project 字段文档 |
| PR 模板变化 | PR Guard workflow、repository setup 文档 |
| label 规则变化 | `.github/labeler.json`, Auto Label workflow, repository setup 文档 |
| 测试流程变化 | `docs/testing/strategy.md`, 测试模板, CI workflow |
| AI review 变化 | Codex prompt、Codex workflow、Secrets/Variables 文档 |
| API 或服务边界变化 | 架构契约、服务文档、测试策略 |

## PR 文档检查清单

- 没有把未合入能力写成当前事实。
- 没有在 README 重复维护完整流程。
- 没有让服务文档重新定义仓库级分支或 PR 规则。
- 新增术语在总入口或相关文档中解释。
- 新增命令可以复制执行，且标明工作目录。
- 修改 workflow 时同步更新配置文档。
- 修改测试要求时同步更新测试模板或策略。

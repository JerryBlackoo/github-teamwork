# AI Agent 协作工作流

本文说明 AI agent 如何参与团队项目，避免本地 AI 状态和公开 GitHub 协作系统混在一起。

## 角色定位

AI agent 可以：

- 阅读代码和文档。
- 拆解需求草案。
- 实现任务。
- 写测试和文档。
- 运行本地验证。
- 帮助填写 PR body。
- 做代码 review。

AI agent 不应该：

- 擅自覆盖远端 issue 当前状态。
- 把本地任务草稿当成公开任务事实。
- 在 review workflow 中执行 PR head 代码。
- 提交本地 secret、token、日志或无关文件。
- 跳过必要检查却声称通过。

## 本地 AI task 和 GitHub Issue 的边界

| 项目 | 用途 | 是否公开派发 |
| --- | --- | --- |
| GitHub Issue | 团队任务书、认领、验收、依赖 | 是 |
| GitHub Project | 任务看板、统计、状态 | 是 |
| Pull Request | 代码和文档合入审查 | 是 |
| 本地 AI task / PRD / journal | agent 自己的上下文和执行计划 | 否 |

## Agent 开始任务前

1. 查远端 issue 是否存在、状态如何、谁已认领。
2. 读 `CONTRIBUTING.md`。
3. 读任务相关 docs。
4. 确认分支来自最新 `develop`。
5. 明确需要运行哪些检查。

## Agent 提交前

- `git status` 只包含当前任务相关文件。
- 已运行相关测试或写明未运行原因。
- 文档与代码事实一致。
- 没有 secret。
- commit message 符合 Conventional Commits。
- PR body 使用中文模板。

## Codex PR Review 的特殊边界

Codex review workflow 运行在 GitHub Actions 中，它只负责审查 PR，不负责改代码。

安全规则：

- checkout base branch。
- PR head 文件只作为不可信输入读取。
- 不执行 PR head 代码。
- 不安装 PR head 依赖。
- 不运行 PR head package scripts。
- 不修改本地 AI task 或 Trellis 状态。
- 输出中文 review，发现问题优先。

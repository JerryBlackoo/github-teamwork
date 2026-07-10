---
name: Task Issue
about: Create a tracked task for issue-driven development
title: '[P/B/F/D/Q/S-001] 中文任务标题'
labels: ''
assignees: ''
---

## 认领规则

- 本任务为自领任务，默认不预分配 Assignee。
- 只允许 1 名主责人完成；认领前请评论 `认领：@你的 GitHub 用户名`。
- 可以请其他成员 review 或协助排障，但主责人只能有 1 个。
- 如需转让，请在 issue 评论中交接清楚。

## 任务信息

- 编号：`P/B/F/D/Q/S-001`
- 状态：`Draft / Ready / In Progress / Blocked / Review / Done`
- 主责小组：`Product / Backend / Frontend / DevOps / QA / Special`
- 优先级：`P0 / P1 / P2`
- 批次：`Batch 0 / Batch 1 / Batch 2 / Batch 3`
- 模块：`frontend / backend / api / docs / ci / infra / testing`
- 预期工时（小时数）：`1`
- 实际工时（小时数）：`0`
- Risk：`Normal / Needs Decision / Blocked`
- 依赖任务：无 / #12 #13
- 阻塞任务：无 / #14 #15
- 并行任务：无 / #16
- 依赖原因：写清楚依赖的接口、schema、数据结构、环境变量、服务能力或验收条件。
- 建议分支：`Team/type/short-title`
- GitHub Project：`Team Project`

## 发布前检查

- 最新分支：`upstream/develop @ <commit>`
- 问题/缺口仍存在：`是；复现或核对方式：<命令、页面路径、日志、截图或链接>`

## 权威依据

- `docs/...`
- GitHub issue 或 PR 链接
- 会议或决策记录

## 任务范围

- ...
- ...

## 交付物

- ...
- ...

## 验收标准

- [ ] ...
- [ ] ...

## 边界与不做内容

- ...

## PR 要求

- PR 目标分支必须是主仓库 `develop`。
- Commit message 使用 Conventional Commits。
- PR 描述列出完成范围、验证命令、未完成风险和关联 issue。

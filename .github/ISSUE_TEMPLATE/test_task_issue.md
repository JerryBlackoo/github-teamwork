---
name: Test Task Issue
about: Create a tracked task for testing work and test execution follow-up
title: '[Q-001] 中文测试任务标题'
labels: 'testing'
assignees: ''
---

## 认领规则

- 本任务为自领任务，默认不预分配 Assignee。
- 只允许 1 名主责人完成；认领前请评论 `认领：@你的 GitHub 用户名`。
- 可以请其他成员 review 或协助排障，但主责人只能有 1 个。

## 任务信息

- 编号：`Q-001`
- 状态：`Draft / Ready / In Progress / Blocked / Review / Done`
- 主责小组：`QA`
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
- 建议分支：`QA/test/short-title`
- GitHub Project：`Team Project`
- Project sync：`pending / synced / blocked`

## 发布前检查

- 最新分支：`upstream/develop @ <commit>`
- 问题/缺口仍存在：`是；复现或核对方式：<命令、页面路径、日志、截图或链接>`

## 权威依据

- `docs/testing/strategy.md`
- `docs/testing/templates/test-report-template.md`
- `docs/...`
- GitHub issue 或 PR 链接

## 任务范围

- ...

## 测试执行与缺陷处理规则

- 本任务不只交付测试代码或测试清单，主责人必须实际运行测试。
- issue/PR 中必须记录执行命令、环境、结果和失败证据。
- 纯单元测试、组件测试或静态检查任务可保留轻量执行记录。
- 集成测试、E2E、权限/安全边界、migration、环境验收、人工验收、回归测试或缺陷复现必须使用 `docs/testing/templates/test-report-template.md` 生成完整测试报告。
- 完整报告保存到 `docs/testing/reports/YYYY-MM-DD/`。
- 测试发现的小问题可以在本任务 PR 中顺手修复，但必须说明修复范围、验证命令和风险。
- 大问题应新建独立 issue 指派给对应 owner 小组，并在本任务中链接。

## 交付物

- 测试报告或轻量执行记录。
- 测试代码、测试清单、脚本或 runbook。
- 实际执行记录：命令、环境、结果、失败证据和未运行原因。
- 发现问题的处理结论：已修复、已转 issue 或暂不处理及原因。

## 验收标准

- [ ] 已按任务范围实际运行测试，而不是只提交测试代码或清单。
- [ ] 已按测试类型留下证据。
- [ ] issue/PR 中记录了执行命令、环境、结果和失败证据。
- [ ] 测试失败时已判断问题等级，并按规则修复或新建 owner issue。
- [ ] 未运行的测试写清楚环境缺口、跳过条件和残余风险。

## 边界与不做内容

- 不在测试任务中扩大修复范围处理大问题。
- 不把 mock、fake、真实 provider smoke 和人工验收混写成同一种测试结论。

## PR 要求

- PR 目标分支必须是主仓库 `develop`。
- Commit message 使用 Conventional Commits。
- PR 描述列出完成范围、验证命令、未完成风险和关联 issue。

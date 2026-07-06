# 测试策略

本文定义团队默认测试协作方式。不同项目应按技术栈补充具体命令。

## 总原则

- 改什么测什么，跨层改动扩大验证范围。
- PR body 必须写清楚已运行命令、结果、未运行原因和残余风险。
- 测试任务必须留下可复核证据。
- 未运行不能写成通过。
- Mock、fake backend、局部 smoke 不等价于完整真实环境验收。
- 发现大问题时拆独立 issue，不把测试任务无限扩大。

## 测试分层

| 层级 | 目的 | 示例 |
| --- | --- | --- |
| 静态检查 | 快速发现格式、类型、lint 问题 | lint, typecheck, format check |
| 单元测试 | 验证纯逻辑和小模块 | service functions, hooks, helpers |
| 组件测试 | 验证 UI 或模块行为 | React/Vue/component tests |
| 集成测试 | 验证数据库、API、服务交互 | repository tests, API tests |
| E2E / smoke | 验证关键用户路径 | login, upload, checkout, report |
| 人工验收 | 验证体验、业务语义和边界 | test report, screenshots, logs |

## PR 前记录格式

```text
已运行：
- <command>：通过。
- <command>：失败，已修复后重跑通过。

未运行：
- <command>：原因：<环境缺失或不相关>。残余风险：<说明>。
```

## 测试任务证据规则

`Q-*` 测试任务必须留下证据。

轻量证据适用于：

- 单元测试。
- 组件测试。
- 静态检查。
- 小范围回归。

完整测试报告适用于：

- 集成测试。
- E2E。
- 权限和安全边界。
- migration 或数据变更。
- 环境验收。
- 人工验收。
- 缺陷复现。
- 跨模块回归。

完整报告使用 [templates/test-report-template.md](templates/test-report-template.md)，保存到：

```text
docs/testing/reports/YYYY-MM-DD/<scope>-test-report.md
```

## 缺陷处理

小问题可以在测试任务 PR 中顺手修复，但必须说明修复范围和验证命令。

大问题必须新建独立 owner issue。大问题包括：

- 跨服务或跨模块契约变更。
- 数据模型或 migration 变更。
- 权限或安全边界缺陷。
- 需要产品或架构决策。
- 会影响多个模块的行为变更。
- 需要 owner 模块重构。

## 项目落地时要补充

在具体项目中补充：

- 前端检查命令。
- 后端检查命令。
- 数据库 migration 验证命令。
- API contract 验证命令。
- E2E smoke 命令。
- CI required checks 列表。
- 环境依赖和跳过条件。

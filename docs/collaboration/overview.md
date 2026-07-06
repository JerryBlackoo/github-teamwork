# 团队协作流程总览

这套模板把团队协作拆成 8 个阶段。

## 1. 项目启动

- 确定仓库主分支模型：`develop` 日常集成，`main` 发布。
- 创建 GitHub Project。
- 配置 Project 字段、label、branch protection、required checks。
- 确定团队分组、模块列表和任务编号前缀。
- 把本模板复制到项目仓库并替换占位内容。

## 2. 需求拆解

- 所有可执行工作都拆成 GitHub Issue。
- 每个 issue 是一份独立任务书。
- 任务书必须包含范围、交付物、验收标准、依赖、边界和验证方式。
- 不把一个大需求塞进单个 issue。

## 3. Project 同步

- `Task Issue Sync` 自动识别标准任务 issue。
- 自动同步 Project 状态、分组、优先级、模块、风险、依赖和工时。
- 自动补 label。
- 同步失败时 `Project sync` 写为 `blocked`，维护者查看 workflow 日志。

## 4. 任务认领

- 默认不预分配 assignee。
- 成员在 issue 评论 `认领：@自己的GitHub用户名`。
- `Task Claim` 自动校验、分配 assignee、改状态为 `In Progress`。
- 已有其他 assignee 时不能抢占。

## 5. 分支开发

- 从最新 `upstream/develop` 创建个人分支。
- 按任务范围提交修改。
- 提交前运行相关检查。
- commit message 使用 Conventional Commits。

## 6. Pull Request

- PR 从个人 fork 指向主仓库 `develop`。
- PR 标题是英文 Conventional Commit。
- PR 正文使用中文模板。
- 关联 issue 使用 `Closes #123` 这类 closing keyword。

## 7. 自动守门和 Review

- PR Guard 检查 base、fork 来源、分支同步和 PR body。
- Commitlint 检查 commit message。
- Auto Label 按账号和路径补 label，并同步 blocked 状态。
- Codex PR Review 输出中文审查意见。
- 人工 reviewer 做最终判断。

## 8. 合并和收尾

- 合并到 `develop`。
- issue 被 PR 自动关闭或手动关闭。
- Project 状态同步为 Done。
- 实际工时自动回填，也可以评论 `实际工时：1.5` 手动修正。
- 测试任务归档证据。
- 文档状态同步，不能把未合入能力写成已实现。

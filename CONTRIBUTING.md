# 协作规范

本仓库推荐采用 fork + PR 的协作方式。所有代码、文档和配置修改默认都通过 Pull Request 合入主仓库的 `develop` 分支。

## 基本原则

- `develop` 是日常集成分支。
- `main` 只用于发布或稳定版本。
- 禁止普通成员直接 push 到 `develop` 或 `main`。
- 日常开发分支从最新 `upstream/develop` 创建。
- PR 目标分支必须是主仓库 `develop`。
- PR 来源应是个人 fork 的独立分支。
- 合并前必须通过协作守门、CI、review 和必要测试。

## 分支命名

推荐格式：

```text
<team>/<type>/<short-description>
```

示例：

```text
Frontend/feat/login-page
Backend/fix/session-expiry
QA/test/auth-regression
DevOps/chore/github-actions
```

推荐 `type`：

| Type | 用途 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档 |
| `style` | 格式，不改变行为 |
| `refactor` | 重构 |
| `test` | 测试 |
| `chore` | 构建、依赖、工具、CI |
| `perf` | 性能 |
| `revert` | 回滚 |

## Commit 规范

所有 commit 使用 Conventional Commits：

```text
<type>(<scope>): <subject>
```

好例子：

```text
feat(frontend): add login form
fix(auth): reject expired sessions
docs(workflow): document pr guard rules
chore(ci): add api type drift check
```

坏例子：

```text
update
fix bug
wip
final
```

规则：

- 第一行不超过 72 个字符。
- subject 使用英文小写开头。
- subject 不以句号结尾。
- 不用模糊词，例如 `update`、`changes`、`misc`。

## 标准开发流程

1. Fork 主仓库到个人账号。
2. 配置 `origin` 为个人 fork，`upstream` 为团队主仓库。
3. 拉取最新 `develop`。
4. 从 `upstream/develop` 创建个人分支。
5. 提交修改。
6. 推送到个人 fork。
7. 创建 PR 到主仓库 `develop`。
8. 等待 CI、PR Guard、Commitlint、已启用的 Codex review 和人工 review。
9. 通过后合并。

常用命令：

```bash
git remote -v
git fetch upstream --prune
git switch -c Frontend/feat/login-page upstream/develop
git status
git add <task-files>
git commit -m "feat(frontend): add login page"
git push -u origin Frontend/feat/login-page
```

创建 PR：

```bash
gh pr create \
  --base develop \
  --head YOUR_NAME:Frontend/feat/login-page \
  --title "feat(frontend): add login page" \
  --template .github/pull_request_template.md
```

如果开发期间 `develop` 更新：

```bash
git fetch upstream --prune
git rebase upstream/develop
git push --force-with-lease
```

只允许对个人 fork 的个人分支使用 `--force-with-lease`，不要对共享分支使用普通 `--force`。

## PR 要求

- PR base 是 `develop`。
- PR head 来自个人 fork。
- PR 标题使用英文 Conventional Commit 风格，不包含中文字符。
- PR 正文使用中文模板，包含 `修改内容`、`关联 Issue`、`验证`、`已知风险`、`检查项`。
- 有 issue 的任务必须在 `关联 Issue` 写 GitHub closing keyword，例如 `Closes #123`。
- 没有关联 issue 时必须写清原因，例如 `无。原因：修正文档错别字，不对应独立任务。`
- PR body 不保留模板占位文字。
- 必须列出已运行检查、未运行检查及原因。

## 合并要求

- PR Guard 通过。
- Commitlint 通过。
- 相关 CI 通过。
- 至少一名维护者或 reviewer 通过。
- 分支包含最新 `develop`。
- 关联任务的验收标准已满足。
- 测试任务已留下证据或报告。

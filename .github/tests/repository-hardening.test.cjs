const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('all GitHub Actions dependencies are pinned to full commit SHAs', () => {
  const workflowDir = path.join(root, '.github', 'workflows');
  for (const name of fs.readdirSync(workflowDir).filter((entry) => entry.endsWith('.yml'))) {
    const source = fs.readFileSync(path.join(workflowDir, name), 'utf8');
    for (const match of source.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gmu)) {
      assert.match(match[1], /@[0-9a-f]{40}$/u, `${name}: ${match[1]} must be pinned`);
    }
  }
});

test('Codex review is opt-in, trusted-only, read-only, and publishes from a separate job', () => {
  const source = read('.github/workflows/codex-pr-review.yml');
  assert.match(source, /vars\.CODEX_REVIEW_ENABLED\s*==\s*'true'/u);
  assert.doesNotMatch(source, /allow-users:\s*["']?\*["']?/u);
  assert.match(source, /permission-profile:\s*["']?:read-only["']?/u);
  assert.match(source, /\n\s{2}publish:\s*\n/u);
  assert.match(source, /needs:\s*review/u);
});

test('Docs Check validates the event commit range instead of the clean worktree', () => {
  const source = read('.github/workflows/docs-check.yml');
  assert.match(source, /github\.event\.pull_request\.base\.sha/u);
  assert.match(source, /github\.event\.before/u);
  assert.doesNotMatch(source, /run:\s*git diff --check\s*$/mu);
});

test('PR Guard validates Conventional Commit PR titles', () => {
  const source = read('.github/workflows/pr-guard.yml');
  assert.match(source, /conventionalTitlePattern/u);
  assert.match(source, /PR title must follow Conventional Commits/u);
});

test('Dependabot targets develop and is explicitly recognized as trusted automation', () => {
  const dependabot = read('.github/dependabot.yml');
  assert.match(dependabot, /^\s*target-branch:\s*develop$/mu);
  assert.match(dependabot, /^\s*prefix:\s*["']chore\(deps\)["']$/mu);
  for (const workflow of ['pr-guard.yml', 'commitlint.yml']) {
    const source = read(`.github/workflows/${workflow}`);
    assert.match(source, /TRUSTED_AUTOMATION_USERS/u);
    assert.match(source, /dependabot\[bot\]/u);
  }
});

test('required workflow jobs expose the documented check names', () => {
  const checks = new Map([
    ['pr-guard.yml', 'PR Guard'],
    ['commitlint.yml', 'Commitlint'],
    ['docs-check.yml', 'Docs Check'],
  ]);
  for (const [workflow, checkName] of checks) {
    const source = read(`.github/workflows/${workflow}`);
    assert.match(source, new RegExp(`^\\s{4}name:\\s*${checkName}$`, 'mu'));
  }
});

test('required read-only checks bind to the pull request commit', () => {
  for (const workflow of ['pr-guard.yml', 'commitlint.yml']) {
    const source = read(`.github/workflows/${workflow}`);
    assert.match(source, /^\s{2}pull_request:\s*$/mu);
    assert.doesNotMatch(source, /^\s{2}pull_request_target:\s*$/mu);
  }
  assert.match(read('.github/workflows/auto-label.yml'), /^\s{2}pull_request_target:\s*$/mu);
});

test('security reporting instructions do not point copied repositories to the template source', () => {
  const security = read('SECURITY.md');
  const issueConfig = read('.github/ISSUE_TEMPLATE/config.yml');
  assert.doesNotMatch(security, /JerryBlackoo\/github-teamwork/u);
  assert.doesNotMatch(issueConfig, /JerryBlackoo\/github-teamwork/u);
  assert.match(security, /Private vulnerability reporting/u);
});

test('issue templates use configured labels and do not expose obsolete sync state', () => {
  const task = read('.github/ISSUE_TEMPLATE/task_issue.md');
  const testTask = read('.github/ISSUE_TEMPLATE/test_task_issue.md');
  assert.doesNotMatch(task, /Project sync/u);
  assert.doesNotMatch(testTask, /Project sync/u);
  assert.match(testTask, /^labels:\s*'area:testing'$/mu);
  const config = read('.github/ISSUE_TEMPLATE/config.yml');
  assert.match(config, /^blank_issues_enabled:\s*false$/mu);
});

test('local Markdown links resolve to repository files', () => {
  const markdownFiles = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.name.endsWith('.md')) markdownFiles.push(absolute);
    }
  };
  visit(root);
  for (const file of markdownFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)) {
      const target = match[1].split('#', 1)[0];
      if (!target || /^(?:https?:|mailto:)/u.test(target)) continue;
      const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
      assert.ok(fs.existsSync(resolved), `${path.relative(root, file)} links to missing ${target}`);
    }
  }
});

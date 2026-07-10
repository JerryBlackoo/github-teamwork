const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const workflowPath = (name) => path.join(repoRoot, '.github', 'workflows', name);
const readWorkflow = (name) => fs.readFileSync(workflowPath(name), 'utf8');

const readGithubScript = (name) => {
  const source = readWorkflow(name).replace(/\r\n/gu, '\n');
  const lines = source.split('\n');
  const markerIndex = lines.findIndex((line) => /^\s+script:\s*\|\s*$/u.test(line));
  assert.notEqual(markerIndex, -1, `${name} must contain a github-script block`);

  const firstScriptLine = lines.slice(markerIndex + 1).find((line) => line.trim());
  assert.ok(firstScriptLine, `${name} github-script block must not be empty`);
  const indent = firstScriptLine.match(/^\s*/u)[0].length;
  const scriptLines = [];
  for (const line of lines.slice(markerIndex + 1)) {
    if (line.trim() && line.match(/^\s*/u)[0].length < indent) break;
    scriptLines.push(line.slice(Math.min(indent, line.length)));
  }
  return scriptLines.join('\n');
};

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const runWorkflowScript = async (name, { github, context, env = {} }) => {
  const warnings = [];
  const failures = [];
  const core = {
    info() {},
    warning(message) { warnings.push(message); },
    setFailed(message) { failures.push(message); },
  };
  const fetch = async () => {
    throw new Error('Unexpected fetch call in workflow test');
  };
  const execute = new AsyncFunction(
    'github',
    'context',
    'core',
    'fetch',
    'process',
    readGithubScript(name)
  );
  await execute(github, context, core, fetch, { env });
  return { warnings, failures };
};

const taskBody = ({
  project = 'Team Project',
  status = 'Ready',
  risk = 'Normal',
  extra = '',
} = {}) => [
  '- 编号：`B-001`',
  `- 状态：\`${status}\``,
  '- 主责小组：`Backend`',
  '- 优先级：`P1`',
  '- 批次：`Batch 0`',
  '- 模块：`docs`',
  '- 预期工时（小时数）：`1`',
  '- 实际工时（小时数）：`0`',
  `- Risk：\`${risk}\``,
  '- 依赖任务：`无`',
  `- GitHub Project：\`${project}\``,
  '- Project sync：`pending`',
  extra,
].filter(Boolean).join('\n');

const taskIssue = (overrides = {}) => ({
  number: 7,
  node_id: 'ISSUE_7',
  title: '[B-001] Implement API',
  body: taskBody(),
  state: 'open',
  author_association: 'MEMBER',
  assignees: [],
  labels: [],
  ...overrides,
});

const claimContext = (
  issue,
  body = '认领：@alice',
  login = 'alice',
  commentId = 1000,
  createdAt = '2026-07-10T01:00:00Z'
) => ({
  eventName: 'issue_comment',
  repo: { owner: 'acme', repo: 'widgets' },
  payload: {
    issue,
    comment: {
      id: commentId,
      body,
      user: { login },
      author_association: 'MEMBER',
      created_at: createdAt,
    },
  },
});

const prGuardContext = (verification) => ({
  repo: { owner: 'acme', repo: 'widgets' },
  payload: {
    pull_request: {
      title: 'fix(workflows): reject template placeholders',
      body: [
        '## 修改内容',
        '',
        '- 修复 PR 验证信息校验。',
        '',
        '## 关联 Issue',
        '',
        '- 无。原因：仓库规则加固，不对应独立任务。',
        '',
        '## 验证',
        '',
        verification,
        '',
        '## 已知风险',
        '',
        '- 无。',
      ].join('\n'),
      base: {
        ref: 'develop',
        repo: { full_name: 'acme/widgets' },
      },
      head: {
        ref: 'fix/pr-guard',
        repo: {
          fork: true,
          full_name: 'alice/widgets',
          owner: { login: 'alice' },
        },
      },
      user: { login: 'alice' },
    },
  },
});

const prGuardGithub = {
  rest: {
    repos: {
      async compareCommitsWithBasehead() {
        return { data: { status: 'ahead' } };
      },
    },
  },
};

const prGuardEnv = {
  ALLOWED_BASE_BRANCHES: 'develop',
  OWNER_DIRECT_BRANCH_USERS: 'acme',
};

const createClaimGithub = (latestIssue) => {
  const issueVersions = Array.isArray(latestIssue) ? latestIssue : [latestIssue];
  let currentIssue = clone(issueVersions[0]);
  const calls = {
    get: [],
    addAssignees: [],
    removeAssignees: [],
    update: [],
    comments: [],
  };
  const github = {
    rest: {
      issues: {
        async get(args) {
          calls.get.push(args);
          const versionIndex = calls.get.length - 1;
          if (versionIndex < issueVersions.length) currentIssue = clone(issueVersions[versionIndex]);
          return { data: clone(currentIssue) };
        },
        async addAssignees(args) { calls.addAssignees.push(args); },
        async removeAssignees(args) { calls.removeAssignees.push(args); },
        async update(args) {
          calls.update.push(args);
          currentIssue.body = args.body;
          return { data: clone(currentIssue) };
        },
        async createComment(args) { calls.comments.push(args); },
      },
    },
    async graphql() {
      throw new Error('Project unavailable in claim boundary test');
    },
  };
  return { github, calls };
};

const projectFields = () => [
  singleSelectField('Status', 'Todo'),
  singleSelectField('Group', 'Backend'),
  singleSelectField('Priority', 'P1'),
  singleSelectField('Batch', 'Batch 0'),
  singleSelectField('Module', 'docs'),
  singleSelectField('Risk', 'Normal'),
  typedField('Dependency', 'TEXT'),
  typedField('ExpectedHours', 'NUMBER'),
  typedField('ActualHours', 'NUMBER'),
  typedField('OwnerNote', 'TEXT'),
];

function singleSelectField(name, optionName) {
  return {
    id: `FIELD_${name}`,
    name,
    dataType: 'SINGLE_SELECT',
    options: [{ id: `OPTION_${name}_${optionName}`, name: optionName }],
  };
}

function typedField(name, dataType) {
  return { id: `FIELD_${name}`, name, dataType };
}

const clone = (value) => JSON.parse(JSON.stringify(value));

const createBarrier = (parties) => {
  let arrivals = 0;
  let release;
  const released = new Promise((resolve) => { release = resolve; });
  return async () => {
    arrivals += 1;
    if (arrivals === parties) release();
    await released;
  };
};

const claimProjectFields = () => [
  singleSelectField('Status', 'In Progress'),
  singleSelectField('Group', 'Backend'),
  singleSelectField('Priority', 'P1'),
  singleSelectField('Batch', 'Batch 0'),
  singleSelectField('Module', 'docs'),
  singleSelectField('Risk', 'Normal'),
  typedField('Dependency', 'TEXT'),
  typedField('ExpectedHours', 'NUMBER'),
  typedField('ActualHours', 'NUMBER'),
  typedField('OwnerNote', 'TEXT'),
];

const createClaimHarness = ({
  initialIssue = taskIssue(),
  logins = ['alice'],
  runnerLogins = {},
  synchronizeClaims = false,
  synchronizeInitialReads = false,
  synchronizeAdds = false,
  beforeAdd,
  onAdd,
  onProjectUpdate,
  initialEvents = [],
  initialComments,
} = {}) => {
  const state = {
    issue: clone(initialIssue),
    events: clone(initialEvents),
    comments: clone(initialComments || logins.map((runnerKey, index) => {
      const login = runnerLogins[runnerKey] || runnerKey;
      return {
        id: 1000 + index,
        body: `认领：@${login}`,
        user: { login },
        created_at: `2026-07-10T01:00:${String(index).padStart(2, '0')}Z`,
      };
    })),
    nextEventId: Math.max(99, ...initialEvents.map((event) => Number(event.id || 0))) + 1,
  };
  const calls = new Map(logins.map((login) => [login, {
    get: [],
    addAssignees: [],
    removeAssignees: [],
    update: [],
    comments: [],
    projectUpdates: [],
  }]));
  const initialReadBarrier = (synchronizeClaims || synchronizeInitialReads)
    ? createBarrier(logins.length)
    : async () => {};
  const addBarrier = (synchronizeClaims || synchronizeAdds)
    ? createBarrier(logins.length)
    : async () => {};

  const githubFor = (runnerKey) => {
    const runnerLogin = runnerLogins[runnerKey] || runnerKey;
    const runnerCalls = calls.get(runnerKey);
    let firstGet = true;
    let projectUpdateCount = 0;
    const listEvents = async () => clone(state.events);
    const listComments = async () => clone(state.comments);
    return {
      rest: {
        issues: {
          listEvents,
          listComments,
          async get(args) {
            runnerCalls.get.push(args);
            if (firstGet) {
              firstGet = false;
              const snapshot = clone(state.issue);
              await initialReadBarrier();
              return { data: snapshot };
            }
            return { data: clone(state.issue) };
          },
          async addAssignees(args) {
            runnerCalls.addAssignees.push(args);
            if (beforeAdd) await beforeAdd({ runnerLogin, state });
            if (synchronizeClaims) {
              const assignmentIndex = logins.indexOf(runnerKey);
              while (state.events.filter((event) => event.event === 'assigned').length < assignmentIndex) {
                await new Promise((resolve) => setTimeout(resolve, 0));
              }
            }
            for (const login of args.assignees) {
              if (!state.issue.assignees.some((assignee) => assignee.login === login)) {
                state.issue.assignees.push({ login });
                state.events.push({
                  id: state.nextEventId++,
                  event: 'assigned',
                  assignee: { login },
                  created_at: '2026-07-10T01:05:00Z',
                });
              }
            }
            if (onAdd) await onAdd({ runnerLogin, state });
            await addBarrier();
          },
          async removeAssignees(args) {
            runnerCalls.removeAssignees.push(args);
            for (const login of args.assignees) {
              state.issue.assignees = state.issue.assignees.filter((assignee) => assignee.login !== login);
              state.events.push({
                id: state.nextEventId++,
                event: 'unassigned',
                assignee: { login },
                created_at: '2026-07-10T01:10:00Z',
              });
            }
          },
          async update(args) {
            runnerCalls.update.push(args);
            state.issue.body = args.body;
            return { data: clone(state.issue) };
          },
          async createComment(args) {
            runnerCalls.comments.push(args);
            state.comments.push({
              id: 9000 + state.comments.length,
              body: args.body,
              user: { login: 'github-actions[bot]' },
              created_at: '2026-07-10T01:20:00Z',
            });
          },
        },
      },
      async paginate(fn, args) { return fn(args); },
      async graphql(query) {
        if (query.includes('addProjectV2ItemById')) {
          return { addProjectV2ItemById: { item: { id: 'ITEM_7' } } };
        }
        if (query.includes('updateProjectV2ItemFieldValue')) {
          projectUpdateCount += 1;
          runnerCalls.projectUpdates.push(query);
          if (onProjectUpdate) {
            await onProjectUpdate({ runnerLogin, projectUpdateCount, state });
          }
          return { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'ITEM_7' } } };
        }
        if (query.includes('projectItems')) {
          return { node: { projectItems: { nodes: [] } } };
        }
        if (query.includes('projectV2(number')) {
          return {
            user: {
              projectV2: {
                id: 'PROJECT_1',
                title: 'Team Project',
                fields: { nodes: claimProjectFields() },
              },
            },
          };
        }
        throw new Error(`Unexpected GraphQL operation: ${query}`);
      },
    };
  };

  return { state, calls, githubFor };
};

const createSyncGithub = ({
  latestIssue,
  title = 'Team Project',
  fields = projectFields(),
  onFieldUpdate,
  repositoryLabels = [
    { name: 'team:backend' },
    { name: 'area:docs' },
  ],
}) => {
  const usesIssueSequence = Array.isArray(latestIssue);
  const issueVersions = usesIssueSequence ? latestIssue : [latestIssue];
  let currentIssue = clone(issueVersions[0]);
  const calls = {
    get: [],
    graphql: [],
    projectMutations: [],
    fieldUpdates: [],
    addLabels: [],
    removeLabel: [],
    update: [],
    createComment: [],
    updateComment: [],
  };
  const listLabelsForRepo = async () => repositoryLabels;
  const github = {
    rest: {
      issues: {
        async get(args) {
          calls.get.push(args);
          const issue = usesIssueSequence
            ? issueVersions[Math.min(calls.get.length - 1, issueVersions.length - 1)]
            : currentIssue;
          return { data: clone(issue) };
        },
        listLabelsForRepo,
        async addLabels(args) { calls.addLabels.push(args); },
        async removeLabel(args) { calls.removeLabel.push(args); },
        async update(args) {
          calls.update.push(args);
          if (!usesIssueSequence) currentIssue.body = args.body;
        },
      },
    },
    async paginate(fn, args) { return fn(args); },
    async graphql(query, variables = {}) {
      calls.graphql.push(query);
      if (query.includes('addProjectV2ItemById')) {
        calls.projectMutations.push('add-item');
        return { addProjectV2ItemById: { item: { id: 'ITEM_7' } } };
      }
      if (query.includes('updateProjectV2ItemFieldValue')) {
        calls.projectMutations.push('update-field');
        calls.fieldUpdates.push(clone(variables));
        if (onFieldUpdate) {
          await onFieldUpdate({
            count: calls.fieldUpdates.length,
            variables,
            setIssue(issue) { currentIssue = clone(issue); },
          });
        }
        return { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'ITEM_7' } } };
      }
      if (query.includes('projectItems')) {
        return { node: { projectItems: { nodes: [] } } };
      }
      if (query.includes('projectV2(number')) {
        return {
          user: {
            projectV2: {
              id: 'PROJECT_1',
              title,
              fields: { nodes: fields },
            },
          },
        };
      }
      throw new Error(`Unexpected GraphQL operation: ${query}`);
    },
  };
  return {
    github,
    calls,
    readIssue: () => clone(currentIssue),
  };
};

const syncContext = (eventIssue) => ({
  eventName: 'issues',
  repo: { owner: 'acme', repo: 'widgets' },
  payload: { issue: eventIssue },
});

const syncEnv = {
  PROJECT_OWNER: 'acme',
  PROJECT_OWNER_TYPE: 'user',
  PROJECT_NUMBER: '1',
  PROJECT_NAME: 'Team Project',
  TASK_ISSUE_NUMBER: '',
};

const createAutoLabelGithub = ({ pr, linkedIssues, lookupErrors = new Set() }) => {
  const calls = { addLabels: [], removeLabel: [] };
  const listLabelsForRepo = async () => [{ name: 'blocked' }];
  const listCommits = async () => [];
  const listFiles = async () => [];
  const github = {
    rest: {
      issues: {
        listLabelsForRepo,
        async get({ issue_number: issueNumber }) {
          if (issueNumber === pr.number) return { data: pr };
          if (lookupErrors.has(issueNumber)) throw Object.assign(new Error('lookup failed'), { status: 500 });
          return { data: linkedIssues.get(issueNumber) };
        },
        async addLabels(args) { calls.addLabels.push(args); },
        async removeLabel(args) { calls.removeLabel.push(args); },
      },
      pulls: { listCommits, listFiles },
      repos: {
        async getContent() {
          return {
            data: {
              encoding: 'base64',
              content: Buffer.from(JSON.stringify({ accountLabels: [], pathLabels: [] })).toString('base64'),
            },
          };
        },
      },
      search: { async issuesAndPullRequests() { return { data: { items: [] } }; } },
    },
    async paginate(fn, args) { return fn(args); },
    async graphql() {
      return {
        repository: {
          pullRequest: {
            closingIssuesReferences: {
              nodes: [...linkedIssues.keys()].map((number) => ({
                number,
                repository: { name: 'widgets', owner: { login: 'acme' } },
              })),
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      };
    },
  };
  return { github, calls };
};

const autoLabelContext = (pr) => ({
  eventName: 'pull_request_target',
  repo: { owner: 'acme', repo: 'widgets' },
  payload: {
    pull_request: {
      number: pr.number,
      base: { sha: 'BASE_SHA' },
      user: { login: 'alice', id: 1 },
    },
  },
});

test('edge-triggered task workflows do not use lossy Actions concurrency queues', () => {
  for (const name of ['task-claim.yml', 'task-issue-sync.yml']) {
    assert.doesNotMatch(
      readWorkflow(name).replace(/\r\n/gu, '\n'),
      /^concurrency:\s*$/mu,
      `${name} must process every event instead of replacing a pending run`
    );
  }
});

test('two interleaved claim events are both processed and converge on one winner', async () => {
  const logins = ['zara', 'alice'];
  const eventIssue = taskIssue();
  const { state, calls, githubFor } = createClaimHarness({
    initialIssue: eventIssue,
    logins,
    synchronizeClaims: true,
  });

  await Promise.all(logins.map((login, index) => runWorkflowScript('task-claim.yml', {
    github: githubFor(login),
    context: claimContext(
      eventIssue,
      `认领：@${login}`,
      login,
      1000 + index,
      `2026-07-10T01:00:${String(index).padStart(2, '0')}Z`
    ),
    env: { ...syncEnv, CLAIM_SETTLE_DELAY_MS: '0' },
  })));

  const winner = state.events.find((event) => event.event === 'assigned').assignee.login;
  const loser = logins.find((login) => login !== winner);
  assert.equal(winner, 'zara', 'the server-ordered first assignment wins, not login sort order');
  assert.deepEqual(state.issue.assignees.map((assignee) => assignee.login), [winner]);
  assert.match(state.issue.body, /- Project sync：`pending`/u);
  assert.equal(calls.get(winner).comments.filter((comment) => comment.body.includes('已认领本任务')).length, 1);
  assert.equal(calls.get(loser).comments.filter((comment) => comment.body.includes('已认领本任务')).length, 0);
  assert.equal(calls.get(loser).comments.some((comment) => comment.body.includes('认领失败')), true);
  assert.equal(calls.get(winner).removeAssignees.length, 0);
  assert.equal(calls.get(loser).removeAssignees.length, 1);
  assert.deepEqual(calls.get(loser).removeAssignees[0].assignees, [loser]);
  assert.equal(calls.get(loser).projectUpdates.length, 0);
});

test('a delayed contender cannot displace a winner with an earlier assignment event', async () => {
  const logins = ['zara', 'alice'];
  const eventIssue = taskIssue();
  const { state, calls, githubFor } = createClaimHarness({
    initialIssue: eventIssue,
    logins,
    synchronizeInitialReads: true,
    beforeAdd: async ({ runnerLogin, state: shared }) => {
      if (runnerLogin !== 'alice') return;
      while (!shared.issue.body.includes('- 状态：`In Progress`')) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    },
  });

  await Promise.all(logins.map((login, index) => runWorkflowScript('task-claim.yml', {
    github: githubFor(login),
    context: claimContext(
      eventIssue,
      `认领：@${login}`,
      login,
      1000 + index,
      `2026-07-10T01:00:${String(index).padStart(2, '0')}Z`
    ),
    env: { ...syncEnv, CLAIM_SETTLE_DELAY_MS: '0' },
  })));

  assert.deepEqual(state.issue.assignees.map((assignee) => assignee.login), ['zara']);
  assert.equal(calls.get('zara').comments.filter((comment) => comment.body.includes('已认领本任务')).length, 1);
  assert.equal(calls.get('alice').comments.filter((comment) => comment.body.includes('已认领本任务')).length, 0);
  assert.deepEqual(calls.get('alice').removeAssignees[0].assignees, ['alice']);
});

test('two claim comments for the same login bind the assignment to the latest valid token', async () => {
  const runnerKeys = ['first', 'second'];
  const issue = taskIssue();
  const { state, calls, githubFor } = createClaimHarness({
    initialIssue: issue,
    logins: runnerKeys,
    runnerLogins: { first: 'alice', second: 'alice' },
    synchronizeClaims: true,
  });

  await Promise.all(runnerKeys.map((runnerKey, index) => runWorkflowScript('task-claim.yml', {
    github: githubFor(runnerKey),
    context: claimContext(
      issue,
      '认领：@alice',
      'alice',
      1000 + index,
      `2026-07-10T01:00:${String(index).padStart(2, '0')}Z`
    ),
    env: { ...syncEnv, CLAIM_SETTLE_DELAY_MS: '0' },
  })));

  assert.deepEqual(state.issue.assignees.map((assignee) => assignee.login), ['alice']);
  assert.equal(calls.get('first').comments.filter((comment) => comment.body.includes('已认领本任务')).length, 0);
  assert.equal(calls.get('second').comments.filter((comment) => comment.body.includes('已认领本任务')).length, 1);
  assert.equal(calls.get('first').removeAssignees.length, 0);
  assert.equal(calls.get('second').removeAssignees.length, 0);
  assert.equal(calls.get('first').projectUpdates.length, 0);
  assert.equal(calls.get('second').projectUpdates.length, 10);
});

test('a new comment owns a reassigned login after the previous assignment epoch ends', async () => {
  const issue = taskIssue({ assignees: [{ login: 'alice' }] });
  const comments = [
    {
      id: 900,
      body: '认领：@alice',
      user: { login: 'alice' },
      created_at: '2026-07-10T00:05:00Z',
    },
    {
      id: 1000,
      body: '认领：@alice',
      user: { login: 'alice' },
      created_at: '2026-07-10T01:00:00Z',
    },
  ];
  const events = [
    { id: 100, event: 'assigned', assignee: { login: 'alice' }, created_at: '2026-07-10T00:10:00Z' },
    { id: 101, event: 'unassigned', assignee: { login: 'alice' }, created_at: '2026-07-10T00:20:00Z' },
    { id: 102, event: 'assigned', assignee: { login: 'alice' }, created_at: '2026-07-10T01:05:00Z' },
  ];
  const { calls, githubFor } = createClaimHarness({
    initialIssue: issue,
    initialEvents: events,
    initialComments: comments,
  });

  await runWorkflowScript('task-claim.yml', {
    github: githubFor('alice'),
    context: claimContext(issue, '认领：@alice', 'alice', 1000, '2026-07-10T01:00:00Z'),
    env: { ...syncEnv, CLAIM_SETTLE_DELAY_MS: '0' },
  });

  assert.equal(calls.get('alice').comments.filter((comment) => comment.body.includes('已认领本任务')).length, 1);
  assert.equal(calls.get('alice').removeAssignees.length, 0);
});

test('a new claim comment supersedes an old comment that never created an assignment', async () => {
  const issue = taskIssue();
  const comments = [
    {
      id: 900,
      body: '认领：@alice',
      user: { login: 'alice' },
      created_at: '2026-07-09T01:00:00Z',
    },
    {
      id: 1000,
      body: '认领：@alice',
      user: { login: 'alice' },
      created_at: '2026-07-10T01:00:00Z',
    },
  ];
  const { state, calls, githubFor } = createClaimHarness({
    initialIssue: issue,
    initialComments: comments,
  });

  await runWorkflowScript('task-claim.yml', {
    github: githubFor('alice'),
    context: claimContext(issue, '认领：@alice', 'alice', 1000, '2026-07-10T01:00:00Z'),
    env: { ...syncEnv, CLAIM_SETTLE_DELAY_MS: '0' },
  });

  assert.match(state.issue.body, /- 状态：`In Progress`/u);
  assert.equal(calls.get('alice').comments.filter((comment) => comment.body.includes('已认领本任务')).length, 1);
  assert.equal(calls.get('alice').removeAssignees.length, 0);
});

test('claim aborts and rolls back itself when the issue closes after assignment', async () => {
  const issue = taskIssue();
  const { state, calls, githubFor } = createClaimHarness({
    initialIssue: issue,
    onAdd: async ({ state: shared }) => { shared.issue.state = 'closed'; },
  });

  await runWorkflowScript('task-claim.yml', {
    github: githubFor('alice'),
    context: claimContext(issue),
    env: { ...syncEnv, CLAIM_SETTLE_DELAY_MS: '0' },
  });

  assert.deepEqual(state.issue.assignees, []);
  assert.equal(calls.get('alice').removeAssignees.length, 1);
  assert.equal(calls.get('alice').projectUpdates.length, 0);
  assert.equal(calls.get('alice').comments.some((comment) => comment.body.includes('已认领本任务')), false);
});

test('claim does not report success when the managed marker disappears before body update', async () => {
  const issue = taskIssue();
  const { state, calls, githubFor } = createClaimHarness({
    initialIssue: issue,
    onProjectUpdate: async ({ projectUpdateCount, state: shared }) => {
      if (projectUpdateCount === 10) shared.issue.body = taskBody({ project: 'Other Project' });
    },
  });

  await runWorkflowScript('task-claim.yml', {
    github: githubFor('alice'),
    context: claimContext(issue),
    env: { ...syncEnv, CLAIM_SETTLE_DELAY_MS: '0' },
  });

  assert.deepEqual(state.issue.assignees, []);
  assert.equal(calls.get('alice').removeAssignees.length, 1);
  assert.equal(calls.get('alice').comments.some((comment) => comment.body.includes('已认领本任务')), false);
});

test('actual-hours update does not report success when its final managed check fails', async () => {
  const issue = taskIssue();
  const { calls, githubFor } = createClaimHarness({
    initialIssue: issue,
    onProjectUpdate: async ({ projectUpdateCount, state: shared }) => {
      if (projectUpdateCount === 3) shared.issue.body = taskBody({ project: 'Other Project' });
    },
  });

  await runWorkflowScript('task-claim.yml', {
    github: githubFor('alice'),
    context: claimContext(issue, '实际工时：2'),
    env: syncEnv,
  });

  assert.equal(calls.get('alice').comments.some((comment) => comment.body.includes('实际工时已更新')), false);
});

test('workflow regression tests are executed by CI with a pinned Node setup action', () => {
  const docsCheck = readWorkflow('docs-check.yml');
  assert.match(
    docsCheck,
    /actions\/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f/u
  );
  assert.match(docsCheck, /node-version:\s*['"]22\.19\.0['"]/u);
  assert.match(docsCheck, /node --test \.github\/tests\/\*\.test\.cjs/u);
});

test('claim refreshes the issue and rejects a concurrent primary assignee', async () => {
  const eventIssue = taskIssue();
  const latestIssue = taskIssue({ assignees: [{ login: 'bob' }] });
  const { github, calls } = createClaimGithub(latestIssue);

  await runWorkflowScript('task-claim.yml', {
    github,
    context: claimContext(eventIssue),
    env: syncEnv,
  });

  assert.equal(calls.get.length, 1);
  assert.equal(calls.addAssignees.length, 0);
  assert.equal(calls.update.length, 0);
  assert.match(calls.comments.at(-1).body, /@bob/u);
});

test('claim only assigns open managed task issues', async (t) => {
  await t.test('closed managed task', async () => {
    const eventIssue = taskIssue();
    const latestIssue = taskIssue({ state: 'closed' });
    const { github, calls } = createClaimGithub(latestIssue);
    await runWorkflowScript('task-claim.yml', {
      github,
      context: claimContext(eventIssue),
      env: syncEnv,
    });
    assert.equal(calls.addAssignees.length, 0);
    assert.equal(calls.update.length, 0);
  });

  await t.test('ordinary issue', async () => {
    const ordinaryIssue = taskIssue({ title: 'Regular bug report' });
    const { github, calls } = createClaimGithub(ordinaryIssue);
    await runWorkflowScript('task-claim.yml', {
      github,
      context: claimContext(ordinaryIssue),
      env: syncEnv,
    });
    assert.equal(calls.addAssignees.length, 0);
    assert.equal(calls.update.length, 0);
    assert.equal(calls.comments.length, 0);
  });

  await t.test('task title with a different Project marker', async () => {
    const otherProjectIssue = taskIssue({ body: taskBody({ project: 'Other Project' }) });
    const { github, calls } = createClaimGithub(otherProjectIssue);
    await runWorkflowScript('task-claim.yml', {
      github,
      context: claimContext(otherProjectIssue),
      env: syncEnv,
    });
    assert.equal(calls.addAssignees.length, 0);
    assert.equal(calls.update.length, 0);
    assert.equal(calls.comments.length, 0);
  });
});

test('actual hours only update a managed task and preserve the latest body', async (t) => {
  await t.test('ordinary issue is not modified', async () => {
    const ordinaryIssue = taskIssue({ title: 'Regular bug report' });
    const { github, calls } = createClaimGithub(ordinaryIssue);
    await runWorkflowScript('task-claim.yml', {
      github,
      context: claimContext(ordinaryIssue, '实际工时：2'),
      env: syncEnv,
    });
    assert.equal(calls.update.length, 0);
    assert.equal(calls.comments.length, 0);
  });

  await t.test('closed managed task can be corrected', async () => {
    const closedIssue = taskIssue({ state: 'closed' });
    const { github, calls } = createClaimGithub(closedIssue);
    await runWorkflowScript('task-claim.yml', {
      github,
      context: claimContext(closedIssue, '实际工时：2'),
      env: syncEnv,
    });
    assert.equal(calls.update.length, 1);
    assert.match(calls.update[0].body, /- 实际工时（小时数）：`2`/u);
    assert.match(calls.update[0].body, /- Project sync：`pending`/u);
  });

  await t.test('body is refreshed again immediately before the update', async () => {
    const eventIssue = taskIssue({ body: taskBody({ extra: 'EVENT_ONLY' }) });
    const firstRead = taskIssue({ body: taskBody({ extra: 'FIRST_READ_ONLY' }) });
    const writeBase = taskIssue({ body: taskBody({ extra: 'LATEST_WRITE_BASE' }) });
    const { github, calls } = createClaimGithub([firstRead, writeBase]);
    await runWorkflowScript('task-claim.yml', {
      github,
      context: claimContext(eventIssue, '实际工时：2'),
      env: syncEnv,
    });
    assert.equal(calls.get.length, 4);
    assert.equal(calls.update.length, 1);
    assert.match(calls.update[0].body, /LATEST_WRITE_BASE/u);
    assert.match(calls.update[0].body, /- Project sync：`pending`/u);
    assert.doesNotMatch(calls.update[0].body, /EVENT_ONLY/u);
    assert.doesNotMatch(calls.update[0].body, /FIRST_READ_ONLY/u);
  });
});

test('task sync never updates the issue body and preserves free text changed during the run', async () => {
  assert.doesNotMatch(
    readWorkflow('task-issue-sync.yml'),
    /task-project-sync-status|github\.rest\.issues\.(?:update|listComments|createComment|updateComment)\s*\(/u,
    'Task Issue Sync must not persist synchronization status on an Issue'
  );
  const issue = taskIssue({ body: taskBody({ extra: 'ORIGINAL_FREE_TEXT' }) });
  const concurrentIssue = taskIssue({ body: taskBody({ extra: 'CONCURRENT_FREE_TEXT' }) });
  const { github, calls, readIssue } = createSyncGithub({
    latestIssue: issue,
    onFieldUpdate: async ({ count, setIssue }) => {
      if (count === 1) setIssue(concurrentIssue);
    },
  });

  await runWorkflowScript('task-issue-sync.yml', {
    github,
    context: syncContext(issue),
    env: syncEnv,
  });

  assert.equal(calls.update.length, 0);
  assert.match(readIssue().body, /CONCURRENT_FREE_TEXT/u);
  assert.doesNotMatch(readIssue().body, /ORIGINAL_FREE_TEXT/u);
});

test('task sync always refreshes the issue before deciding whether it is managed', async () => {
  const eventIssue = taskIssue();
  const latestIssue = taskIssue({ title: 'Regular bug report' });
  const { github, calls } = createSyncGithub({ latestIssue });

  await runWorkflowScript('task-issue-sync.yml', {
    github,
    context: syncContext(eventIssue),
    env: syncEnv,
  });

  assert.equal(calls.get.length, 1);
  assert.equal(calls.graphql.length, 0);
  assert.equal(calls.addLabels.length, 0);
  assert.equal(calls.update.length, 0);
});

test('task sync retries a stale Project write and converges to the latest source fingerprint', async () => {
  const oldIssue = taskIssue();
  const newIssue = taskIssue({
    body: taskBody().replace(
      '- 实际工时（小时数）：`0`',
      '- 实际工时（小时数）：`5`'
    ),
  });
  const { github, calls, readIssue } = createSyncGithub({
    latestIssue: oldIssue,
    onFieldUpdate: async ({ count, setIssue }) => {
      if (count === 1) setIssue(newIssue);
    },
  });

  await runWorkflowScript('task-issue-sync.yml', {
    github,
    context: syncContext(oldIssue),
    env: syncEnv,
  });

  const actualHoursWrites = calls.fieldUpdates.filter(
    (update) => update.fieldId === 'FIELD_ActualHours'
  );
  assert.ok(calls.fieldUpdates.length > 10, 'the stale attempt must be followed by a full retry');
  assert.equal(actualHoursWrites.at(-1).value.number, 5);
  assert.equal(calls.update.length, 0);
  assert.match(readIssue().body, /- 实际工时（小时数）：`5`/u);
});

test('task sync reports configuration failures without writing the issue', async () => {
  const issue = taskIssue();
  const { github, calls } = createSyncGithub({
    latestIssue: issue,
    title: 'Different Project',
  });

  const result = await runWorkflowScript('task-issue-sync.yml', {
    github,
    context: syncContext(issue),
    env: syncEnv,
  });

  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /sync blocked/u);
  assert.match(result.failures[0], /Different Project/u);
  assert.equal(calls.update.length, 0);
  assert.equal(calls.createComment.length, 0);
  assert.equal(calls.updateComment.length, 0);
});

test('task sync reports an unstable source without writing the issue', async () => {
  const issue = taskIssue();
  const { github, calls } = createSyncGithub({
    latestIssue: issue,
    onFieldUpdate: async ({ count, setIssue }) => {
      setIssue(taskIssue({
        body: taskBody().replace(
          '- 实际工时（小时数）：`0`',
          `- 实际工时（小时数）：\`${count}\``
        ),
      }));
    },
  });

  const result = await runWorkflowScript('task-issue-sync.yml', {
    github,
    context: syncContext(issue),
    env: syncEnv,
  });

  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /sync blocked/u);
  assert.match(result.failures[0], /source changed/iu);
  assert.equal(calls.update.length, 0);
  assert.equal(calls.createComment.length, 0);
  assert.equal(calls.updateComment.length, 0);
});

test('task sync validates Project identity and the complete schema before mutations', async (t) => {
  const expectedOptions = new Map([
    ['Status', 'Todo'],
    ['Group', 'Backend'],
    ['Priority', 'P1'],
    ['Batch', 'Batch 0'],
    ['Module', 'docs'],
    ['Risk', 'Normal'],
  ]);
  const expectedTypes = new Map([
    ...[...expectedOptions.keys()].map((name) => [name, 'SINGLE_SELECT']),
    ['Dependency', 'TEXT'],
    ['ExpectedHours', 'NUMBER'],
    ['ActualHours', 'NUMBER'],
    ['OwnerNote', 'TEXT'],
  ]);
  const cases = [
    {
      name: 'Project title mismatch',
      title: 'Different Project',
      fields: projectFields(),
    },
  ];
  for (const [fieldName, expectedType] of expectedTypes) {
    cases.push({
      name: `missing ${fieldName}`,
      title: 'Team Project',
      fields: projectFields().filter((field) => field.name !== fieldName),
    });
    const wrongType = expectedType === 'TEXT' ? 'NUMBER' : 'TEXT';
    cases.push({
      name: `${fieldName} has wrong type`,
      title: 'Team Project',
      fields: projectFields().map((field) => (
        field.name === fieldName ? typedField(fieldName, wrongType) : field
      )),
    });
  }
  for (const [fieldName, optionName] of expectedOptions) {
    cases.push({
      name: `${fieldName} is missing option ${optionName}`,
      title: 'Team Project',
      fields: projectFields().map((field) => (
        field.name === fieldName ? singleSelectField(fieldName, 'Wrong option') : field
      )),
    });
  }

  for (const fixture of cases) {
    await t.test(fixture.name, async () => {
      const issue = taskIssue();
      const { github, calls } = createSyncGithub({
        latestIssue: issue,
        title: fixture.title,
        fields: fixture.fields,
      });
      await runWorkflowScript('task-issue-sync.yml', {
        github,
        context: syncContext(issue),
        env: syncEnv,
      });
      assert.deepEqual(calls.projectMutations, []);
      assert.deepEqual(calls.addLabels, []);
    });
  }
});

test('task sync mutates the Project after a complete valid schema passes', async () => {
  const issue = taskIssue();
  const { github, calls } = createSyncGithub({ latestIssue: issue });

  await runWorkflowScript('task-issue-sync.yml', {
    github,
    context: syncContext(issue),
    env: syncEnv,
  });

  assert.equal(calls.addLabels.length, 1);
  assert.equal(calls.projectMutations.filter((operation) => operation === 'add-item').length, 1);
  assert.equal(calls.projectMutations.filter((operation) => operation === 'update-field').length, 10);
  assert.equal(calls.update.length, 0);
  assert.equal(calls.createComment.length, 0);
  assert.equal(calls.updateComment.length, 0);
});

test('task sync ignores managed-looking issues from untrusted authors', async () => {
  const issue = taskIssue({ author_association: 'NONE' });
  const { github, calls } = createSyncGithub({ latestIssue: issue });

  await runWorkflowScript('task-issue-sync.yml', {
    github,
    context: syncContext(issue),
    env: syncEnv,
  });

  assert.deepEqual(calls.projectMutations, []);
  assert.deepEqual(calls.addLabels, []);
  assert.deepEqual(calls.removeLabel, []);
});

test('task sync replaces stale managed labels and preserves unrelated labels', async () => {
  const issue = taskIssue({
    labels: [
      { name: 'team:frontend' },
      { name: 'area:frontend' },
      { name: 'security' },
    ],
  });
  const { github, calls } = createSyncGithub({
    latestIssue: issue,
    repositoryLabels: [
      { name: 'team:backend' },
      { name: 'team:frontend' },
      { name: 'area:docs' },
      { name: 'area:frontend' },
      { name: 'security' },
    ],
  });

  await runWorkflowScript('task-issue-sync.yml', {
    github,
    context: syncContext(issue),
    env: syncEnv,
  });

  assert.deepEqual(calls.addLabels[0].labels.sort(), ['area:docs', 'team:backend']);
  assert.deepEqual(calls.removeLabel.map((call) => call.name).sort(), ['area:frontend', 'team:frontend']);
});

test('a PR is blocked when any closing issue is blocked', async () => {
  const pr = { number: 42, labels: [] };
  const linkedIssues = new Map([
    [7, taskIssue({ number: 7, body: taskBody({ status: 'Blocked', risk: 'Blocked' }) })],
    [8, taskIssue({ number: 8 })],
  ]);
  const { github, calls } = createAutoLabelGithub({ pr, linkedIssues });

  await runWorkflowScript('auto-label.yml', {
    github,
    context: autoLabelContext(pr),
  });

  assert.equal(calls.addLabels.length, 1);
  assert.deepEqual(calls.addLabels[0].labels, ['blocked']);
  assert.equal(calls.removeLabel.length, 0);
});

test('a closing-issue lookup error preserves an existing blocked label', async () => {
  const pr = { number: 42, labels: [{ name: 'blocked' }] };
  const linkedIssues = new Map([
    [7, taskIssue({ number: 7 })],
    [8, taskIssue({ number: 8 })],
  ]);
  const { github, calls } = createAutoLabelGithub({
    pr,
    linkedIssues,
    lookupErrors: new Set([8]),
  });

  const result = await runWorkflowScript('auto-label.yml', {
    github,
    context: autoLabelContext(pr),
  });

  assert.equal(calls.addLabels.length, 0);
  assert.equal(calls.removeLabel.length, 0);
  assert.ok(result.warnings.some((message) => message.includes('#8')));
});

test('PR Guard rejects untouched verification placeholders', async () => {
  const verification = [
    '已运行：',
    '',
    '- `<command>`：<结果>',
    '',
    '未运行：',
    '',
    '- 无。或填写 `<command>`：原因：<原因>；残余风险：<风险>。',
  ].join('\n');

  const result = await runWorkflowScript('pr-guard.yml', {
    github: prGuardGithub,
    context: prGuardContext(verification),
    env: prGuardEnv,
  });

  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /template placeholder text/u);
});

test('PR Guard accepts completed verification evidence', async () => {
  const verification = [
    '已运行：',
    '',
    '- `node --test .github/tests/*.test.cjs`：通过。',
    '',
    '未运行：',
    '',
    '- `actionlint`：原因：本地未安装；残余风险：Actions schema 由 CI 检查。',
  ].join('\n');

  const result = await runWorkflowScript('pr-guard.yml', {
    github: prGuardGithub,
    context: prGuardContext(verification),
    env: prGuardEnv,
  });

  assert.deepEqual(result.failures, []);
});

test('PR Guard accepts trusted Dependabot pull requests without human template sections', async () => {
  const context = prGuardContext('unused');
  const pr = context.payload.pull_request;
  pr.title = 'Bump actions/checkout from 6 to 7';
  pr.body = 'Bumps actions/checkout from 6 to 7.';
  pr.user.login = 'dependabot[bot]';
  pr.head.repo = {
    fork: false,
    full_name: 'acme/widgets',
    owner: { login: 'acme' },
  };

  const result = await runWorkflowScript('pr-guard.yml', {
    github: prGuardGithub,
    context,
    env: { ...prGuardEnv, TRUSTED_AUTOMATION_USERS: 'dependabot[bot]' },
  });

  assert.deepEqual(result.failures, []);
});

test('Commitlint delegates generated messages from trusted automation', async () => {
  const result = await runWorkflowScript('commitlint.yml', {
    github: {},
    context: {
      repo: { owner: 'acme', repo: 'widgets' },
      payload: { pull_request: { number: 42, user: { login: 'dependabot[bot]' } } },
    },
    env: { TRUSTED_AUTOMATION_USERS: 'dependabot[bot]' },
  });

  assert.deepEqual(result.failures, []);
});

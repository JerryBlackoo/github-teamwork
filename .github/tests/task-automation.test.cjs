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
  assignees: [],
  labels: [],
  ...overrides,
});

const claimContext = (issue, body = '认领：@alice', login = 'alice') => ({
  eventName: 'issue_comment',
  repo: { owner: 'acme', repo: 'widgets' },
  payload: {
    issue,
    comment: {
      body,
      user: { login },
      author_association: 'MEMBER',
    },
  },
});

const createClaimGithub = (latestIssue) => {
  const issueVersions = Array.isArray(latestIssue) ? latestIssue : [latestIssue];
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
          return { data: issueVersions[Math.min(calls.get.length - 1, issueVersions.length - 1)] };
        },
        async addAssignees(args) { calls.addAssignees.push(args); },
        async removeAssignees(args) { calls.removeAssignees.push(args); },
        async update(args) { calls.update.push(args); },
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
  synchronizeClaims = false,
  synchronizeInitialReads = false,
  synchronizeAdds = false,
  beforeAdd,
  onAdd,
  onProjectUpdate,
} = {}) => {
  const state = {
    issue: clone(initialIssue),
    events: [],
    nextEventId: 100,
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

  const githubFor = (runnerLogin) => {
    const runnerCalls = calls.get(runnerLogin);
    let firstGet = true;
    let projectUpdateCount = 0;
    const listEvents = async () => clone(state.events);
    return {
      rest: {
        issues: {
          listEvents,
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
              const assignmentIndex = logins.indexOf(runnerLogin);
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
              });
            }
          },
          async update(args) {
            runnerCalls.update.push(args);
            state.issue.body = args.body;
            return { data: clone(state.issue) };
          },
          async createComment(args) { runnerCalls.comments.push(args); },
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

const createSyncGithub = ({ latestIssue, title = 'Team Project', fields = projectFields() }) => {
  const issueVersions = Array.isArray(latestIssue) ? latestIssue : [latestIssue];
  const calls = {
    get: [],
    graphql: [],
    projectMutations: [],
    addLabels: [],
    update: [],
  };
  const listLabelsForRepo = async () => [
    { name: 'team:backend' },
    { name: 'area:docs' },
  ];
  const github = {
    rest: {
      issues: {
        async get(args) {
          calls.get.push(args);
          return { data: issueVersions[Math.min(calls.get.length - 1, issueVersions.length - 1)] };
        },
        listLabelsForRepo,
        async addLabels(args) { calls.addLabels.push(args); },
        async update(args) { calls.update.push(args); },
      },
    },
    async paginate(fn, args) { return fn(args); },
    async graphql(query) {
      calls.graphql.push(query);
      if (query.includes('addProjectV2ItemById')) {
        calls.projectMutations.push('add-item');
        return { addProjectV2ItemById: { item: { id: 'ITEM_7' } } };
      }
      if (query.includes('updateProjectV2ItemFieldValue')) {
        calls.projectMutations.push('update-field');
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
  return { github, calls };
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

  await Promise.all(logins.map((login) => runWorkflowScript('task-claim.yml', {
    github: githubFor(login),
    context: claimContext(eventIssue, `认领：@${login}`, login),
    env: { ...syncEnv, CLAIM_SETTLE_DELAY_MS: '0' },
  })));

  const winner = state.events.find((event) => event.event === 'assigned').assignee.login;
  const loser = logins.find((login) => login !== winner);
  assert.equal(winner, 'zara', 'the server-ordered first assignment wins, not login sort order');
  assert.deepEqual(state.issue.assignees.map((assignee) => assignee.login), [winner]);
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

  await Promise.all(logins.map((login) => runWorkflowScript('task-claim.yml', {
    github: githubFor(login),
    context: claimContext(eventIssue, `认领：@${login}`, login),
    env: { ...syncEnv, CLAIM_SETTLE_DELAY_MS: '0' },
  })));

  assert.deepEqual(state.issue.assignees.map((assignee) => assignee.login), ['zara']);
  assert.equal(calls.get('zara').comments.filter((comment) => comment.body.includes('已认领本任务')).length, 1);
  assert.equal(calls.get('alice').comments.filter((comment) => comment.body.includes('已认领本任务')).length, 0);
  assert.deepEqual(calls.get('alice').removeAssignees[0].assignees, ['alice']);
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
    assert.equal(calls.get.length, 2);
    assert.equal(calls.update.length, 1);
    assert.match(calls.update[0].body, /LATEST_WRITE_BASE/u);
    assert.doesNotMatch(calls.update[0].body, /EVENT_ONLY/u);
    assert.doesNotMatch(calls.update[0].body, /FIRST_READ_ONLY/u);
  });
});

test('task sync refreshes the body again before writing Project sync', async () => {
  const firstRead = taskIssue({ body: taskBody({ extra: 'FIRST_READ_ONLY' }) });
  const writeBase = taskIssue({ body: taskBody({ extra: 'LATEST_WRITE_BASE' }) });
  const fields = projectFields().filter((field) => field.name !== 'OwnerNote');
  const { github, calls } = createSyncGithub({
    latestIssue: [firstRead, writeBase],
    fields,
  });

  await runWorkflowScript('task-issue-sync.yml', {
    github,
    context: syncContext(firstRead),
    env: syncEnv,
  });

  assert.equal(calls.get.length, 2);
  assert.equal(calls.update.length, 1);
  assert.match(calls.update[0].body, /LATEST_WRITE_BASE/u);
  assert.doesNotMatch(calls.update[0].body, /FIRST_READ_ONLY/u);
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
  assert.equal(calls.update.length, 1);
  assert.match(calls.update[0].body, /- Project sync：`synced`/u);
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

// Test-only identities. Each local project owns a login budget; remote identities stay exact.
const projects = {'desktop-chromium': 'desktop', 'mobile-chromium': 'mobile'};
const accounts = [
  ['TEACHER', 'teacher-m3', 'Docente M3', 'teacher'],
  ['STUDENT_A', 'student-a-m3', 'Studente A M3', 'student'],
  ['STUDENT_B', 'student-b-m3', 'Studente B M3', 'student'],
];

export function projectCredentials(env, mode, project, kind) {
  if (!accounts.some(([name]) => name === kind)) throw Error('Unknown synthetic account kind.');
  const username = env[`ARDESIA_E2E_${kind}_USERNAME`], password = env[`ARDESIA_E2E_${kind}_PASSWORD`];
  if (!username || !password) throw Error('Synthetic credentials must be supplied by the test runner.');
  if (mode === 'remote') return {username, password};
  if (mode !== 'local' || !Object.hasOwn(projects, project)) throw Error('Unknown local browser project.');
  const scoped = `${username}-${projects[project]}`;
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(scoped)) throw Error('Invalid scoped synthetic username.');
  return {username: scoped, password};
}

export function localBrowserAccounts(env) {
  return Object.keys(projects).flatMap(project => [...accounts.map(([kind, id, displayName, role]) => ({
    id: `${id}-${projects[project]}`, displayName, role, ...projectCredentials(env, 'local', project, kind),
  })), {id:`personal-student-m3-${projects[project]}`,displayName:'Studente creativo M3',role:'student',...personalBrowserCredentials(env,'local',project)},
    {id:`evidence-student-m3-${projects[project]}`,displayName:'Studente evidenze M3',role:'student',...evidenceBrowserCredentials(env,'local',project)}]);
}

// Dedicated local authoring fixtures do not consume the fresh-session QA login budget.
export function personalBrowserCredentials(env, mode, project) {
  if (mode !== 'local') throw Error('Personal authoring fixtures require local mode.');
  const value = projectCredentials(env, mode, project, 'STUDENT_A');
  const username = value.username + '-personal';
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) throw Error('Invalid scoped synthetic username.');
  return {...value,username};
}

// Evidence-chain scenarios own their local login budget, separate from acceptance.
export function evidenceBrowserCredentials(env, mode, project) {
  if (mode !== 'local') throw Error('Evidence fixtures require local mode.');
  const value = projectCredentials(env, mode, project, 'STUDENT_B');
  const username = value.username + '-evidence';
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) throw Error('Invalid scoped synthetic username.');
  return {...value,username};
}

export function projectCredentialEnvironment(env, mode, project) {
  return Object.fromEntries(accounts.flatMap(([kind]) => {
    const {username, password} = projectCredentials(env, mode, project, kind);
    return [[`ARDESIA_E2E_${kind}_USERNAME`, username], [`ARDESIA_E2E_${kind}_PASSWORD`, password]];
  }));
}

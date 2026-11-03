type Environment = Record<string, string | undefined>;
type Kind = 'TEACHER' | 'STUDENT_A' | 'STUDENT_B';
export declare function projectCredentials(env: Environment, mode: 'local' | 'remote', project: string, kind: Kind): {username: string; password: string};
export declare function localBrowserAccounts(env: Environment): {id: string; displayName: string; role: 'teacher' | 'student'; username: string; password: string}[];
export declare function projectCredentialEnvironment(env: Environment, mode: 'local' | 'remote', project: string): Record<string, string>;

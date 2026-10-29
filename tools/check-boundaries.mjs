import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {relative, resolve} from 'node:path';
import {files, root} from './evidence.mjs';

const dependencies = {
  contracts: [], core: ['contracts'], 'lesson-os': ['contracts'],
  'plugin-sdk': [], 'plugin-host': ['plugin-sdk', 'contracts'], ui: [],
  web: ['contracts', 'core', 'lesson-os', 'plugin-sdk', 'plugin-host', 'ui']
};
const errors = [];
const areaOf = path => path.match(/^(?:packages|apps)\/([^/]+)\//)?.[1];
for (const absolute of files().filter(file => /\.[cm]?[jt]sx?$/.test(file))) {
  const path = relative(root, absolute), area = areaOf(path);
  if(!area) continue;
  const sf = ts.createSourceFile(path, readFileSync(absolute, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    let literal;
    if((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) literal = node.moduleSpecifier;
    if(ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(sf) === 'require')) literal = node.arguments[0];
    if(literal && !ts.isStringLiteral(literal)) errors.push(`${path}: nonliteral module loading is not allowed`);
    if(literal && ts.isStringLiteral(literal)) {
      const name = literal.text;
      if(name.startsWith('@ardesia/')) {
        const [target, ...rest] = name.slice(9).split('/');
        if(!dependencies[area]?.includes(target)) errors.push(`${path}: ${area} cannot import ${target}`);
        if(rest.length && !(target === 'ui' && rest.join('/') === 'tokens.css')) errors.push(`${path}: only public package exports are allowed (${name})`);
      } else if(name.startsWith('.')) {
        const resolved = relative(root, resolve(absolute, '..', name));
        if(areaOf(resolved) && areaOf(resolved) !== area) errors.push(`${path}: relative cross-boundary import (${name})`);
      } else if(area !== 'web' && /^(react|react-dom|@vite)/.test(name)) errors.push(`${path}: framework in domain package`);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}
if(errors.length) {console.error(errors.join('\n')); process.exit(1);}
console.log('Module boundaries: PASS (one app, public exports, declared dependency direction).');

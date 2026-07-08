#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const defaultReportPath = path.join(repoRoot, 'artifacts', 'api-contracts', 'report.txt');

const args = process.argv.slice(2);
const reportPath = getArgValue('--report') ?? defaultReportPath;
const maxCriticalIssues = getIntegerOption('--max-critical-issues', 'API_CONTRACT_MAX_CRITICAL_ISSUES', 0);
const selfTest = args.includes('--self-test');

const frontendRoots = [
  path.join(repoRoot, 'frontend', 'web'),
  path.join(repoRoot, 'frontend', 'mobile'),
  path.join(repoRoot, 'frontend', 'api-contracts'),
];
const backendRoot = path.join(repoRoot, 'backend', 'src', 'main', 'java');

const frontendUsages = [];
const backendRoutes = [];
const suspiciousMappings = [];
const parserMisses = [];
const unreadableFiles = [];

if (selfTest) {
  runSelfTests();
} else {
  await main();
}

async function main() {
  const frontendFiles = [];
  for (const root of frontendRoots) {
    frontendFiles.push(...(await walkFiles(root, isFrontendSourceFile)));
  }
  const backendFiles = await walkFiles(backendRoot, (filePath) => filePath.endsWith('Controller.java'));

  for (const filePath of frontendFiles) {
    const text = await readText(filePath);
    if (text == null) {
      continue;
    }
    frontendUsages.push(...extractFrontendUsages(filePath, text));
  }

  for (const filePath of backendFiles) {
    const text = await readText(filePath);
    if (text == null) {
      continue;
    }
    const parsed = extractBackendRoutes(filePath, text);
    backendRoutes.push(...parsed.routes);
    suspiciousMappings.push(...parsed.suspicious);
    parserMisses.push(...parsed.parserMisses);
  }

  const frontendIndex = buildRouteIndex(frontendUsages);
  const backendIndex = buildRouteIndex(backendRoutes);
  const unmatchedFrontendUsages = [];

  for (const usage of frontendUsages) {
    const exactKey = routeMatchKey(usage.method, usage.route);
    const wildcardKey = routeMatchKey('ANY', usage.route);
    const matched = backendIndex.has(exactKey) || backendIndex.has(wildcardKey);
    if (!matched) {
      unmatchedFrontendUsages.push(usage);
    }
  }

  const criticalUnmatchedFrontendUsages = unmatchedFrontendUsages.filter((usage) => isContractBoundaryFile(usage.filePath));

  const unusedBackendRoutes = backendRoutes.filter((route) => {
    const exactKey = routeMatchKey(route.method, route.route);
    const wildcardKey = routeMatchKey('ANY', route.route);
    return !frontendIndex.has(exactKey) && !frontendIndex.has(wildcardKey);
  });

  const duplicateReports = findDuplicateEndpointPayloads(frontendUsages.filter((usage) => isContractBoundaryFile(usage.filePath)));

  const report = buildReport({
    frontendCount: frontendUsages.length,
    backendCount: backendRoutes.length,
    maxCriticalIssues,
    unmatchedFrontendUsages,
    criticalUnmatchedFrontendUsages,
    unusedBackendRoutes,
    suspiciousMappings,
    parserMisses,
    duplicateReports,
    unreadableFiles,
  });

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report, 'utf8');

  const blockingCriticalIssues = criticalUnmatchedFrontendUsages.length + suspiciousMappings.length + duplicateReports.length;
  if (blockingCriticalIssues > maxCriticalIssues || parserMisses.length) {
    process.exitCode = 1;
  }
}

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}

function getIntegerOption(flag, envName, defaultValue) {
  const rawValue = getArgValue(flag) ?? process.env[envName];
  if (rawValue == null || rawValue === '') {
    return defaultValue;
  }

  const value = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer`);
  }
  return value;
}

async function walkFiles(rootDir, predicate) {
  const results = [];
  await walkDirectory(rootDir, predicate, results);
  return results;
}

async function walkDirectory(dirPath, predicate, results) {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }
      await walkDirectory(fullPath, predicate, results);
      continue;
    }

    if (entry.isFile() && predicate(fullPath)) {
      results.push(fullPath);
    }
  }
}

function shouldSkipDirectory(directoryName) {
  return directoryName === 'node_modules' || directoryName === '.next' || directoryName === 'dist' || directoryName === 'build' || directoryName === 'coverage' || directoryName === 'target';
}

function isFrontendSourceFile(filePath) {
  if (!/\.(ts|tsx)$/.test(filePath)) {
    return false;
  }
  if (filePath.endsWith('.d.ts')) {
    return false;
  }
  if (/[/\\]__tests__[/\\]/.test(filePath)) {
    return false;
  }
  return !/\.(test|spec)\.(ts|tsx)$/.test(filePath);
}

async function readText(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    unreadableFiles.push({ filePath, error: String(error) });
    return null;
  }
}

function extractFrontendUsages(filePath, text) {
  const usages = [];
  const lines = text.split(/\r?\n/);
  const callRegex = /\b(?:[A-Za-z_$][\w$]*\.(?:get|post|put|patch|delete)|fetch)\s*(?:<[^>]*>\s*)?\(/g;

  while (true) {
    const match = callRegex.exec(text);
    if (!match) {
      break;
    }

    const openParenIndex = callRegex.lastIndex - 1;
    const call = extractBalanced(text, openParenIndex, '(', ')');
    if (!call) {
      continue;
    }

    const callText = text.slice(match.index, call.endIndex + 1);
    const method = extractMethodFromCall(match[0], callText);
    const args = splitTopLevelArguments(call.content);
    const rawEndpoint = args[0]?.trim();
    const route = normalizeRoute(rawEndpoint);
    if (!route || !route.startsWith('/api/')) {
      continue;
    }

    const line = lineFromIndex(text, match.index);
    const functionName = inferFunctionName(lines, line - 1);
    const payloadSignature = extractPayloadSignature(method, args);

    usages.push({
      filePath,
      line,
      method,
      route,
      rawEndpoint,
      functionName,
      payloadSignature,
    });
  }

  return usages;
}

function extractMethodFromCall(callStart, callText) {
  if (callStart.startsWith('fetch')) {
    const methodMatch = callText.match(/method\s*:\s*['"]([A-Z]+)['"]/);
    return methodMatch?.[1]?.toUpperCase() ?? 'GET';
  }

  const methodMatch = callStart.match(/\.(get|post|put|patch|delete)\b/i);
  return methodMatch?.[1]?.toUpperCase() ?? 'GET';
}

function extractPayloadSignature(method, args) {
  if (!['POST', 'PUT', 'PATCH'].includes(method)) {
    return null;
  }

  const payload = args[1]?.trim();
  if (!payload) {
    return null;
  }

  if (payload.startsWith('{') && payload.endsWith('}')) {
    const keys = extractObjectLiteralKeys(payload);
    return `object:${keys.join(',')}`;
  }

  return `expr:${normalizeInlineExpression(payload)}`;
}

function findDuplicateEndpointPayloads(usages) {
  const groups = new Map();

  for (const usage of usages) {
    if (!usage.payloadSignature) {
      continue;
    }

    const key = routeKey(usage.method, usage.route);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(usage);
  }

  const reports = [];
  for (const [key, entries] of groups.entries()) {
    const signatures = new Map();
    for (const entry of entries) {
      if (!signatures.has(entry.payloadSignature)) {
        signatures.set(entry.payloadSignature, []);
      }
      signatures.get(entry.payloadSignature).push(entry);
    }

    if (signatures.size <= 1) {
      continue;
    }

    reports.push({
      key,
      route: entries[0].route,
      method: entries[0].method,
      variants: [...signatures.entries()].map(([signature, sites]) => ({ signature, sites })),
    });
  }

  return reports;
}

function buildRouteIndex(routes) {
  const keys = new Set();

  for (const route of routes) {
    keys.add(routeMatchKey(route.method, route.route));
    keys.add(routeMatchKey('ANY', route.route));
  }

  return keys;
}

function extractBackendRoutes(filePath, text) {
  const scanText = stripJavaComments(text);
  const routes = [];
  const suspicious = [];
  const parserMisses = [];
  const annotations = findMappingAnnotations(scanText);
  const classes = findControllerClassDeclarations(scanText);

  for (let classIndex = 0; classIndex < classes.length; classIndex++) {
    const classInfo = classes[classIndex];
    const classEnd = classInfo.end ?? scanText.length;
    const classAnnotations = findClassMappingAnnotations(annotations, classInfo.index);
    const classBasePaths = classAnnotations.flatMap((annotation) => extractAnnotationPaths(annotation));
    const effectiveClassPaths = classBasePaths.length ? classBasePaths : [''];
    const classPathLine = classAnnotations[0]?.line ?? classInfo.line;

    for (const rawPath of effectiveClassPaths) {
      if (isSuspiciousPathFragment(rawPath)) {
        suspicious.push({
          filePath,
          line: classPathLine,
          rawPath,
          context: 'class-level mapping',
        });
      }
    }

    const methodGroups = new Map();
    const classMethodAnnotations = annotations.filter((annotation) => annotation.index > classInfo.bodyStart && annotation.index < classEnd);

    for (const annotation of classMethodAnnotations) {
      const method = findNextMethodDeclaration(scanText, annotation.end, classEnd);
      if (!method) {
        parserMisses.push({
          filePath,
          line: annotation.line,
          annotation: annotation.name,
          reason: 'mapping annotation not followed by a method declaration',
        });
        continue;
      }

      if (!methodGroups.has(method.index)) {
        methodGroups.set(method.index, {
          method,
          annotations: [],
        });
      }
      methodGroups.get(method.index).annotations.push(annotation);
    }

    for (const group of methodGroups.values()) {
      const methodAnnotations = uniqueAnnotations(group.annotations);
      const methodPaths = methodAnnotations.flatMap((annotation) => extractAnnotationPaths(annotation));
      const methods = extractAnnotationMethods(methodAnnotations);
      const effectiveMethodPaths = methodPaths.length ? methodPaths : [''];
      const methodLine = methodAnnotations[0]?.line ?? group.method.line;

      for (const rawClassPath of effectiveClassPaths) {
        for (const rawMethodPath of effectiveMethodPaths) {
          const combinedRoute = normalizeRoute(joinRoute(rawClassPath, rawMethodPath));
          if (!combinedRoute || !combinedRoute.startsWith('/api/')) {
            continue;
          }

          for (const method of methods) {
            routes.push({
              filePath,
              line: methodLine,
              method,
              route: combinedRoute,
            });
          }
        }
      }

      for (const rawPath of [...effectiveClassPaths, ...effectiveMethodPaths]) {
        if (isSuspiciousPathFragment(rawPath)) {
          suspicious.push({
            filePath,
            line: methodLine,
            rawPath,
            context: 'method-level mapping',
          });
        }
      }
    }
  }

  return { routes: dedupeRoutes(routes), suspicious: dedupeIssues(suspicious), parserMisses: dedupeIssues(parserMisses) };
}

function stripJavaComments(text) {
  let result = '';
  let index = 0;
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (escape) {
      result += char;
      escape = false;
      index += 1;
      continue;
    }

    if (char === '\\') {
      result += char;
      escape = true;
      index += 1;
      continue;
    }

    if (!inDouble && char === '\'') {
      inSingle = !inSingle;
      result += char;
      index += 1;
      continue;
    }

    if (!inSingle && char === '"') {
      inDouble = !inDouble;
      result += char;
      index += 1;
      continue;
    }

    if (!inSingle && !inDouble && char === '/' && next === '/') {
      result += '  ';
      index += 2;
      while (index < text.length && text[index] !== '\n') {
        result += ' ';
        index += 1;
      }
      continue;
    }

    if (!inSingle && !inDouble && char === '/' && next === '*') {
      result += '  ';
      index += 2;
      while (index < text.length - 1 && !(text[index] === '*' && text[index + 1] === '/')) {
        result += text[index] === '\n' ? '\n' : ' ';
        index += 1;
      }
      if (index < text.length) {
        result += '  ';
        index += 2;
      }
      continue;
    }

    result += char;
    index += 1;
  }

  return result;
}

function findMappingAnnotations(text) {
  const annotations = [];
  const annotationRegex = /@(?:[A-Za-z_$][\w$]*\.)*(RequestMapping|GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping)\b/g;
  let match;

  while ((match = annotationRegex.exec(text))) {
    let end = annotationRegex.lastIndex;
    let content = '';
    while (/\s/.test(text[end] ?? '')) {
      end += 1;
    }

    if (text[end] === '(') {
      const balanced = extractBalanced(text, end, '(', ')');
      if (balanced) {
        content = balanced.content;
        end = balanced.endIndex + 1;
      }
    }

    annotations.push({
      name: match[1],
      text: text.slice(match.index, end),
      content,
      index: match.index,
      end,
      line: lineFromIndex(text, match.index),
    });
    annotationRegex.lastIndex = end;
  }

  return annotations;
}

function findControllerClassDeclarations(text) {
  const classes = [];
  const classRegex = /\b(?:public|protected|private|abstract|final|static|\s)*class\s+([A-Za-z_$][\w$]*)\b/g;
  let match;
  while ((match = classRegex.exec(text))) {
    const annotationWindow = text.slice(Math.max(0, match.index - 2000), match.index);
    if (!/@(?:[A-Za-z_$][\w$]*\.)*(?:RestController|Controller)\b/.test(annotationWindow)) {
      continue;
    }

    const bodyStart = text.indexOf('{', classRegex.lastIndex);
    const bodyEnd = bodyStart >= 0 ? findMatchingBrace(text, bodyStart) : -1;
    classes.push({
      name: match[1],
      index: match.index,
      bodyStart,
      end: bodyEnd > bodyStart ? bodyEnd : text.length,
      line: lineFromIndex(text, match.index),
    });
  }
  return classes;
}

function findMatchingBrace(text, openIndex) {
  const balanced = extractBalanced(text, openIndex, '{', '}');
  return balanced ? balanced.endIndex : -1;
}

function findClassMappingAnnotations(annotations, classIndex) {
  const windowStart = Math.max(0, classIndex - 2000);
  return annotations.filter((annotation) => annotation.name === 'RequestMapping' && annotation.end <= classIndex && annotation.index >= windowStart);
}

function findNextMethodDeclaration(text, startIndex, endIndex) {
  const slice = text.slice(startIndex, endIndex);
  const methodRegex = /\b(?:public|protected|private)\s+(?:static\s+)?(?:final\s+)?(?:<[^>{}]+>\s+)?[\w<>\[\],.? extends super&\s]+\s+([A-Za-z_$][\w$]*)\s*\([^;{}]*\)\s*(?:throws\s+[\w<>\[\],.? extends super&\s]+)?\{/g;
  const match = methodRegex.exec(slice);
  if (!match) {
    return null;
  }
  const index = startIndex + match.index;
  return {
    name: match[1],
    index,
    line: lineFromIndex(text, index),
  };
}

function uniqueAnnotations(annotations) {
  const seen = new Set();
  const unique = [];
  for (const annotation of annotations) {
    if (seen.has(annotation.index)) {
      continue;
    }
    seen.add(annotation.index);
    unique.push(annotation);
  }
  return unique.sort((a, b) => a.index - b.index);
}

function dedupeRoutes(routes) {
  const seen = new Set();
  const deduped = [];
  for (const route of routes) {
    const key = `${route.filePath}:${route.line}:${route.method}:${route.route}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(route);
  }
  return deduped;
}

function dedupeIssues(issues) {
  const seen = new Set();
  const deduped = [];
  for (const issue of issues) {
    const key = JSON.stringify(issue);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(issue);
  }
  return deduped;
}

function extractAnnotationPaths(annotations) {
  const paths = [];
  const list = Array.isArray(annotations) ? annotations : [annotations];
  for (const annotation of list) {
    paths.push(...extractMappingPathValues(annotation.content));
  }
  return paths.length ? paths : [''];
}

function extractMappingPathValues(content) {
  const trimmed = content.trim();
  if (!trimmed) {
    return [''];
  }

  const explicitValues = [];
  for (const attrValue of findPathValueAttributes(trimmed)) {
    explicitValues.push(...extractQuotedStrings(attrValue));
  }

  if (explicitValues.length) {
    return explicitValues;
  }

  const firstArg = splitTopLevelArguments(trimmed)[0]?.trim();
  if (!firstArg || /=/.test(firstArg)) {
    return [''];
  }

  const positionalValues = extractQuotedStrings(firstArg);
  return positionalValues.length ? positionalValues : [''];
}

function findPathValueAttributes(text) {
  const values = [];
  const attrRegex = /\b(path|value)\b\s*=/g;
  let match;
  while ((match = attrRegex.exec(text))) {
    let valueStart = attrRegex.lastIndex;
    while (/\s/.test(text[valueStart] ?? '')) {
      valueStart += 1;
    }
    const attrValue = readJavaAnnotationValue(text, valueStart);
    if (attrValue) {
      values.push(attrValue.value);
      attrRegex.lastIndex = attrValue.end;
    }
  }
  return values;
}

function readJavaAnnotationValue(text, startIndex) {
  let depthParen = 0;
  let depthBrace = 0;
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (let index = startIndex; index < text.length; index++) {
    const char = text[index];

    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (inSingle) {
      if (char === '\'') {
        inSingle = false;
      }
      continue;
    }
    if (inDouble) {
      if (char === '"') {
        inDouble = false;
      }
      continue;
    }
    if (char === '\'') {
      inSingle = true;
      continue;
    }
    if (char === '"') {
      inDouble = true;
      continue;
    }
    if (char === '(') {
      depthParen += 1;
      continue;
    }
    if (char === ')') {
      if (depthParen > 0) {
        depthParen -= 1;
      }
      continue;
    }
    if (char === '{') {
      depthBrace += 1;
      continue;
    }
    if (char === '}') {
      if (depthBrace > 0) {
        depthBrace -= 1;
      }
      continue;
    }
    if (char === ',' && depthParen === 0 && depthBrace === 0) {
      return {
        value: text.slice(startIndex, index).trim(),
        end: index,
      };
    }
  }

  const value = text.slice(startIndex).trim();
  return value ? { value, end: text.length } : null;
}

function extractAnnotationMethods(annotations) {
  const methods = [];
  for (const annotation of annotations) {
    if (annotation.name !== 'RequestMapping') {
      methods.push(annotation.name.replace('Mapping', '').toUpperCase());
      continue;
    }

    const requestMethods = [...annotation.content.matchAll(/RequestMethod\.(GET|POST|PUT|PATCH|DELETE)/g)].map((match) => match[1]);
    if (requestMethods.length) {
      methods.push(...requestMethods);
    } else {
      methods.push('ANY');
    }
  }

  return methods.length ? methods : ['ANY'];
}

function extractQuotedStrings(text) {
  const results = [];
  const stringRegex = /['"]([^'"]+)['"]/g;
  let match;
  while ((match = stringRegex.exec(text))) {
    results.push(match[1]);
  }
  return results;
}

function isSuspiciousPathFragment(rawPath) {
  if (!rawPath) {
    return false;
  }

  const trimmed = rawPath.trim();
  if (trimmed.startsWith('/')) {
    return false;
  }
  if (trimmed.startsWith('{')) {
    return false;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return false;
  }

  return /[A-Za-z0-9]/.test(trimmed);
}

function joinRoute(basePath, methodPath) {
  const base = normalizeRouteFragment(basePath);
  const child = normalizeRouteFragment(methodPath);
  if (!base) {
    return child;
  }
  if (!child) {
    return base;
  }
  return `${base.replace(/\/$/, '')}/${child.replace(/^\//, '')}`;
}

function normalizeRouteFragment(fragment) {
  if (!fragment) {
    return '';
  }
  let value = fragment.trim();
  value = value.replace(/^['"]|['"]$/g, '');
  value = value.replace(/\$\{([^}]+)\}/g, (_, expr) => `:${paramName(expr)}`);
  value = value.replace(/\{([^}]+)\}/g, (_, expr) => `:${paramName(expr)}`);
  return value;
}

function normalizeRoute(rawEndpoint) {
  if (!rawEndpoint) {
    return '';
  }

  let value = rawEndpoint.trim();
  value = value.replace(/^['"`]|['"`]$/g, '');
  value = value.replace(/\$\{([^}]+)\}/g, (_, expr) => `:${paramName(expr)}`);
  value = value.replace(/\{([^}]+)\}/g, (_, expr) => `:${paramName(expr)}`);
  value = value.replace(/^https?:\/\/[^/]+/i, '');

  const apiIndex = value.indexOf('/api/');
  if (apiIndex >= 0) {
    value = value.slice(apiIndex);
  } else {
    const bareApiIndex = value.indexOf('api/');
    if (bareApiIndex >= 0) {
      value = value.slice(bareApiIndex);
    }
  }

  value = value.split(/[?#]/, 1)[0];
  value = value.replace(/\/{2,}/g, '/');

  if (value && !value.startsWith('/')) {
    value = `/${value}`;
  }

  return value;
}

function paramName(expr) {
  const tokens = String(expr).match(/[A-Za-z_$][\w$]*/g);
  return tokens?.at(-1) ?? 'param';
}

function splitTopLevelArguments(text) {
  const args = [];
  let current = '';
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escape = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === '\\') {
      current += char;
      escape = true;
      continue;
    }

    if (inSingle) {
      current += char;
      if (char === '\'') {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      current += char;
      if (char === '"') {
        inDouble = false;
      }
      continue;
    }

    if (inTemplate) {
      current += char;
      if (char === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (char === '/' && text[index + 1] === '/') {
      while (index < text.length && text[index] !== '\n') {
        current += text[index];
        index += 1;
      }
      if (index < text.length) {
        current += text[index];
      }
      continue;
    }

    if (char === '/' && text[index + 1] === '*') {
      current += '/*';
      index += 2;
      while (index < text.length - 1 && !(text[index] === '*' && text[index + 1] === '/')) {
        current += text[index];
        index += 1;
      }
      current += '*/';
      index += 1;
      continue;
    }

    if (char === '\'') {
      current += char;
      inSingle = true;
      continue;
    }

    if (char === '"') {
      current += char;
      inDouble = true;
      continue;
    }

    if (char === '`') {
      current += char;
      inTemplate = true;
      continue;
    }

    if (char === '(') {
      depthParen += 1;
      current += char;
      continue;
    }

    if (char === ')') {
      if (depthParen > 0) {
        depthParen -= 1;
      }
      current += char;
      continue;
    }

    if (char === '[') {
      depthBracket += 1;
      current += char;
      continue;
    }

    if (char === ']') {
      if (depthBracket > 0) {
        depthBracket -= 1;
      }
      current += char;
      continue;
    }

    if (char === '{') {
      depthBrace += 1;
      current += char;
      continue;
    }

    if (char === '}') {
      if (depthBrace > 0) {
        depthBrace -= 1;
      }
      current += char;
      continue;
    }

    if (char === ',' && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      if (current.trim()) {
        args.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

function extractBalanced(text, openIndex, openChar, closeChar) {
  let depth = 1;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escape = false;

  for (let index = openIndex + 1; index < text.length; index++) {
    const char = text[index];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (inSingle) {
      if (char === '\'') {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      if (char === '"') {
        inDouble = false;
      }
      continue;
    }

    if (inTemplate) {
      if (char === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (char === '\'') {
      inSingle = true;
      continue;
    }

    if (char === '"') {
      inDouble = true;
      continue;
    }

    if (char === '`') {
      inTemplate = true;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: text.slice(openIndex + 1, index),
          endIndex: index,
        };
      }
    }
  }

  return null;
}

function extractObjectLiteralKeys(text) {
  const inner = text.trim().replace(/^\{/, '').replace(/\}$/, '');
  const keys = new Set();
  const keyRegex = /(?:^|,\s*)([A-Za-z_$][\w$]*)\s*:/g;
  let match;
  while ((match = keyRegex.exec(inner))) {
    keys.add(match[1]);
  }

  const shorthandRegex = /(?:^|,\s*)([A-Za-z_$][\w$]*)\s*(?:,|$)/g;
  while ((match = shorthandRegex.exec(inner))) {
    const key = match[1];
    if (!inner.includes(`${key}:`)) {
      keys.add(key);
    }
  }

  return [...keys].sort();
}

function normalizeInlineExpression(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\b(?:async|await)\b/g, '')
    .trim();
}

function inferFunctionName(lines, lineIndex) {
  const start = Math.max(0, lineIndex - 10);
  for (let index = lineIndex; index >= start; index--) {
    const line = lines[index].trim();
    const match = line.match(/^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)\s*=>|function\b)/) || line.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/) || line.match(/^([A-Za-z_$][\w$]*)\s*:\s*async\s*\(/);
    if (match) {
      return match[1];
    }
  }
  return 'unknown';
}

function lineFromIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function routeKey(method, route) {
  return `${method.toUpperCase()} ${route}`;
}

function routeMatchKey(method, route) {
  return routeKey(method, collapseRouteVariables(route));
}

function collapseRouteVariables(route) {
  return route.replace(/:[A-Za-z_$][\w$]*/g, ':*');
}

function buildReport({
  frontendCount,
  backendCount,
  maxCriticalIssues,
  unmatchedFrontendUsages,
  criticalUnmatchedFrontendUsages,
  unusedBackendRoutes,
  suspiciousMappings,
  parserMisses,
  duplicateReports,
  unreadableFiles,
}) {
  const lines = [];
  lines.push('Planora API Contract Check');
  lines.push(`Frontend call sites scanned: ${frontendCount}`);
  lines.push(`Backend routes scanned: ${backendCount}`);
  lines.push('');

  if (suspiciousMappings.length) {
    lines.push(`Suspicious mappings missing leading slash: ${suspiciousMappings.length}`);
    for (const issue of suspiciousMappings.slice(0, 50)) {
      lines.push(`- ${relativePath(issue.filePath)}:${issue.line} [${issue.context}] ${issue.rawPath}`);
    }
    if (suspiciousMappings.length > 50) {
      lines.push(`- ... ${suspiciousMappings.length - 50} more`);
    }
    lines.push('');
  }

  if (parserMisses.length) {
    lines.push(`Likely backend parser misses: ${parserMisses.length}`);
    for (const miss of parserMisses.slice(0, 50)) {
      lines.push(`- ${relativePath(miss.filePath)}:${miss.line} @${miss.annotation} ${miss.reason}`);
    }
    if (parserMisses.length > 50) {
      lines.push(`- ... ${parserMisses.length - 50} more`);
    }
    lines.push('');
  }

  if (unmatchedFrontendUsages.length) {
    lines.push(`Frontend calls with no backend match: ${unmatchedFrontendUsages.length}`);
    for (const usage of unmatchedFrontendUsages.slice(0, 100)) {
      lines.push(`- ${relativePath(usage.filePath)}:${usage.line} ${usage.method} ${usage.route}${usage.functionName !== 'unknown' ? ` (${usage.functionName})` : ''}`);
    }
    if (unmatchedFrontendUsages.length > 100) {
      lines.push(`- ... ${unmatchedFrontendUsages.length - 100} more`);
    }
    lines.push('');
  }

  if (criticalUnmatchedFrontendUsages.length) {
    lines.push(`Critical frontend contract misses: ${criticalUnmatchedFrontendUsages.length}`);
    for (const usage of criticalUnmatchedFrontendUsages.slice(0, 50)) {
      lines.push(`- ${relativePath(usage.filePath)}:${usage.line} ${usage.method} ${usage.route}`);
    }
    if (criticalUnmatchedFrontendUsages.length > 50) {
      lines.push(`- ... ${criticalUnmatchedFrontendUsages.length - 50} more`);
    }
    lines.push('');
  }

  if (duplicateReports.length) {
    lines.push(`Duplicate divergent frontend endpoint payloads: ${duplicateReports.length}`);
    for (const report of duplicateReports.slice(0, 20)) {
      lines.push(`- ${report.method} ${report.route}`);
      for (const variant of report.variants) {
        const sites = variant.sites.map((site) => `${relativePath(site.filePath)}:${site.line}`).join(', ');
        lines.push(`  - ${variant.signature}: ${sites}`);
      }
    }
    if (duplicateReports.length > 20) {
      lines.push(`- ... ${duplicateReports.length - 20} more`);
    }
    lines.push('');
  }

  lines.push(`Backend endpoints with no frontend/mobile usage: ${unusedBackendRoutes.length}`);
  for (const route of unusedBackendRoutes.slice(0, 100)) {
    lines.push(`- ${relativePath(route.filePath)}:${route.line} ${route.method} ${route.route}`);
  }
  if (unusedBackendRoutes.length > 100) {
    lines.push(`- ... ${unusedBackendRoutes.length - 100} more`);
  }
  lines.push('');

  if (unreadableFiles.length) {
    lines.push(`Unreadable files: ${unreadableFiles.length}`);
    for (const issue of unreadableFiles) {
      lines.push(`- ${relativePath(issue.filePath)}: ${issue.error}`);
    }
    lines.push('');
  }

  lines.push('Summary');
  const blockingCriticalIssues = criticalUnmatchedFrontendUsages.length + suspiciousMappings.length + duplicateReports.length;
  lines.push(`- Blocking critical issues: ${blockingCriticalIssues}`);
  lines.push(`- Allowed blocking critical issues: ${maxCriticalIssues}`);
  lines.push(`- Likely parser misses: ${parserMisses.length}`);
  lines.push(`- Informational backend-only routes: ${unusedBackendRoutes.length}`);

  return `${lines.join('\n')}\n`;
}

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function isContractBoundaryFile(filePath) {
  const relative = relativePath(filePath);
  return (
    /\/services\//.test(relative)
    || /\/hooks\//.test(relative)
    || /\/lib\//.test(relative)
    || /\/app\/.+\/api\.ts$/.test(relative)
    || /\/src\/services\//.test(relative)
    || /\/src\/hooks\//.test(relative)
    || /\/src\/lib\//.test(relative)
  );
}

function runSelfTests() {
  const cases = [
    {
      name: 'TeamController-style class base plus empty method mappings',
      source: `
        package test;
        @RestController
        @RequestMapping("/api/teams")
        @RequiredArgsConstructor
        public class TeamController {
          @GetMapping("/check-name")
          public ResponseEntity<Map<String, Boolean>> checkTeamName(@RequestParam String name) {
            return null;
          }

          @PostMapping
          public ResponseEntity<TeamSummaryDTO> createTeam(
              @Valid @RequestBody TeamCreationDTO creationDTO) {
            return null;
          }

          @GetMapping
          public ResponseEntity<List<TeamSummaryDTO>> getAllTeams() {
            return null;
          }

          @PutMapping("/{id}")
          public ResponseEntity<TeamSummaryDTO> updateTeam(@PathVariable Long id) {
            return null;
          }
        }
      `,
      expected: [
        'GET /api/teams/check-name',
        'POST /api/teams',
        'GET /api/teams',
        'PUT /api/teams/:id',
      ],
    },
    {
      name: 'TaskController-style path variables and attribute mappings',
      source: `
        @RestController
        @RequestMapping(path = "/api/tasks")
        public class TaskController {
          @PostMapping
          public ResponseEntity<TaskResponseDTO> createTask(
              @Validated @RequestBody TaskRequestDTO request,
              @AuthenticationPrincipal UserPrincipal currentUser) {
            return null;
          }

          @GetMapping(value = "/{taskId}")
          public ResponseEntity<TaskResponseDTO> getTaskById(
              @PathVariable Long taskId,
              @RequestParam(required = false) String repoFullName) {
            return null;
          }

          @PatchMapping(path = "/{taskId}/dates")
          public ResponseEntity<TaskResponseDTO> patchTaskDates(
              @PathVariable Long taskId,
              @Valid @RequestBody PatchTaskDatesRequest request) {
            return null;
          }

          @DeleteMapping(value = "/bulk")
          public ResponseEntity<Void> bulkDelete(@Valid @RequestBody BulkDeleteTasksRequest request) {
            return null;
          }
        }
      `,
      expected: [
        'POST /api/tasks',
        'GET /api/tasks/:taskId',
        'PATCH /api/tasks/:taskId/dates',
        'DELETE /api/tasks/bulk',
      ],
    },
    {
      name: 'Arrays, multiline declarations, and non-path attributes',
      source: `
        @RestController
        @RequestMapping({"/api/github/webhook", "/api/github/webhooks"})
        public
        class GitHubWebhookController {
          @PostMapping(
              consumes = "application/json"
          )
          public ResponseEntity<Void> receiveWebhook() {
            return null;
          }

          @GetMapping(path = {"/issues/{owner}/{repo}/labels", "/labels"})
          public
          ResponseEntity<Void>
          labels() {
            return null;
          }
        }
      `,
      expected: [
        'POST /api/github/webhook',
        'POST /api/github/webhooks',
        'GET /api/github/webhook/issues/:owner/:repo/labels',
        'GET /api/github/webhook/labels',
        'GET /api/github/webhooks/issues/:owner/:repo/labels',
        'GET /api/github/webhooks/labels',
      ],
      rejected: [
        'POST /api/github/webhook/application/json',
      ],
    },
    {
      name: 'Missing slash warning mirrors TeamController typo',
      source: `
        @RestController
        @RequestMapping("api/teams")
        public class TeamController {
          @GetMapping("check-name")
          public ResponseEntity<Void> checkTeamName() {
            return null;
          }
        }
      `,
      expected: [
        'GET /api/teams/check-name',
      ],
      suspicious: [
        'api/teams',
        'check-name',
      ],
    },
  ];

  for (const testCase of cases) {
    const parsed = extractBackendRoutes(`${testCase.name}.java`, testCase.source);
    const actual = new Set(parsed.routes.map((route) => `${route.method} ${route.route}`));
    for (const expectedRoute of testCase.expected) {
      assert(actual.has(expectedRoute), `${testCase.name}: expected ${expectedRoute}`);
    }
    for (const rejectedRoute of testCase.rejected ?? []) {
      assert(!actual.has(rejectedRoute), `${testCase.name}: rejected ${rejectedRoute}`);
    }
    for (const expectedSuspicious of testCase.suspicious ?? []) {
      assert(parsed.suspicious.some((issue) => issue.rawPath === expectedSuspicious), `${testCase.name}: expected suspicious ${expectedSuspicious}`);
    }
    assert(parsed.parserMisses.length === 0, `${testCase.name}: unexpected parser misses ${JSON.stringify(parsed.parserMisses)}`);
  }

  console.log(`check-api-contracts self-test passed (${cases.length} fixtures)`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

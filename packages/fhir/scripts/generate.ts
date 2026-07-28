import AdmZip from 'adm-zip';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import * as tar from 'tar';

type StructureKind = 'resource' | 'complex-type' | 'primitive-type' | 'logical';

interface StructureDefinition {
  resourceType: 'StructureDefinition';
  id?: string;
  url?: string;
  name: string;
  type: string;
  kind: StructureKind;
  abstract?: boolean;
  derivation?: 'specialization' | 'constraint';
  snapshot?: {
    element?: ElementDefinition[];
  };
}

interface ElementDefinition {
  id?: string;
  path: string;
  min?: number;
  max?: string;
  short?: string;
  definition?: string;
  contentReference?: string;
  type?: ElementType[];
}

interface ElementType {
  code: string;
  profile?: string[];
  targetProfile?: string[];
}

interface CliOptions {
  release: string;
  file: string;
  outRoot: string;
}

interface GenerationContext {
  knownTypes: Set<string>;
  backbonePathNames: Map<string, string>;
  missingTypes: Set<string>;
}

const primitiveTypeMap = new Map<string, string>([
  ['base64Binary', 'string'],
  ['boolean', 'boolean'],
  ['canonical', 'string'],
  ['code', 'string'],
  ['date', 'string'],
  ['dateTime', 'string'],
  ['decimal', 'number'],
  ['id', 'string'],
  ['instant', 'string'],
  ['integer', 'number'],
  ['integer64', 'string'],
  ['markdown', 'string'],
  ['oid', 'string'],
  ['positiveInt', 'number'],
  ['string', 'string'],
  ['time', 'string'],
  ['unsignedInt', 'number'],
  ['uri', 'string'],
  ['url', 'string'],
  ['uuid', 'string'],
  ['xhtml', 'string'],

  // FHIRPath system types sometimes appear in definitions.
  ['http://hl7.org/fhirpath/System.Boolean', 'boolean'],
  ['http://hl7.org/fhirpath/System.String', 'string'],
  ['http://hl7.org/fhirpath/System.Integer', 'number'],
  ['http://hl7.org/fhirpath/System.Decimal', 'number'],
  ['http://hl7.org/fhirpath/System.Date', 'string'],
  ['http://hl7.org/fhirpath/System.DateTime', 'string'],
  ['http://hl7.org/fhirpath/System.Time', 'string'],
]);

const primitiveCodes = new Set(primitiveTypeMap.keys());

const backboneCodes = new Set(['BackboneElement', 'BackboneType']);

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];

    if (current.startsWith('--') && current.includes('=')) {
      const [key, value] = current.slice(2).split('=', 2);
      args.set(key, value);
      continue;
    }

    if (current.startsWith('--')) {
      const key = current.slice(2);
      const value = argv[i + 1];

      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for --${key}`);
      }

      args.set(key, value);
      i += 1;
    }
  }

  const release = args.get('release');
  const file = args.get('file');
  const outRoot = args.get('out') ?? 'src';

  if (!release || !file) {
    throw new Error(
      [
        'Usage:',
        '  tsx scripts/generate.ts --release r4 --file definitions/r4/definitions.json.zip',
        '',
        'Options:',
        '  --release  Output release folder, for example r4, r4b, r5',
        '  --file     Input .json, .zip, .tgz, .tar.gz, or directory containing FHIR StructureDefinition JSON',
        '  --out      Output root directory. Default: src',
      ].join('\n')
    );
  }

  return {
    release: sanitizeReleaseName(release),
    file,
    outRoot,
  };
}

function sanitizeReleaseName(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');

  if (!sanitized) {
    throw new Error('Release name is empty after sanitization.');
  }

  return sanitized;
}

async function collectStructureDefinitions(inputPath: string): Promise<StructureDefinition[]> {
  const absolutePath = path.resolve(inputPath);
  if (path.isAbsolute(inputPath) || inputPath.includes('..')) {
    throw new Error(`Invalid input file: ${inputPath}`);
  }
  const inputStat = await stat(absolutePath);

  if (inputStat.isDirectory()) {
    return collectFromDirectory(absolutePath);
  }

  if (absolutePath.endsWith('.json')) {
    const json = JSON.parse(await readFile(absolutePath, 'utf8'));
    return collectFromJson(json);
  }

  if (absolutePath.endsWith('.zip')) {
    return collectFromZip(absolutePath);
  }

  if (
    absolutePath.endsWith('.tgz') ||
    absolutePath.endsWith('.tar.gz') ||
    absolutePath.endsWith('.tar')
  ) {
    return collectFromTarball(absolutePath);
  }

  throw new Error(`Unsupported input file: ${inputPath}`);
}

async function collectFromDirectory(directory: string): Promise<StructureDefinition[]> {
  const files = await walk(directory);
  const results: StructureDefinition[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    try {
      const base = path.resolve(directory);
      const target = path.resolve(file);
      const relative = path.relative(base, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        continue;
      }
      const json = JSON.parse(await readFile(target, 'utf8'));
      results.push(...collectFromJson(json));
    } catch {
      // Some JSON files in packages may not be FHIR resources. Ignore malformed or irrelevant files.
    }
  }

  return results;
}

async function collectFromZip(file: string): Promise<StructureDefinition[]> {
  const zip = new AdmZip(file);
  const results: StructureDefinition[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !entry.entryName.endsWith('.json')) {
      continue;
    }

    try {
      const json = JSON.parse(entry.getData().toString('utf8'));
      results.push(...collectFromJson(json));
    } catch {
      // Ignore non-resource JSON.
    }
  }

  return results;
}

async function collectFromTarball(file: string): Promise<StructureDefinition[]> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'fhir-package-'));

  try {
    await tar.x({
      file,
      cwd: tempDir,
    });

    return await collectFromDirectory(tempDir);
  } finally {
    await rm(tempDir, {
      recursive: true,
      force: true,
    });
  }
}

function collectFromJson(json: unknown): StructureDefinition[] {
  const results: StructureDefinition[] = [];

  function visit(value: unknown): void {
    if (!value || typeof value !== 'object') {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }

      return;
    }

    const resource = value as Record<string, unknown>;

    if (resource.resourceType === 'StructureDefinition') {
      results.push(resource as unknown as StructureDefinition);
      return;
    }

    if (resource.resourceType === 'Bundle' && Array.isArray(resource.entry)) {
      for (const entry of resource.entry) {
        if (entry && typeof entry === 'object' && 'resource' in entry) {
          visit((entry as { resource?: unknown }).resource);
        }
      }
    }
  }

  visit(json);
  return results;
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function getBaseDefinitions(definitions: StructureDefinition[]): StructureDefinition[] {
  const byType = new Map<string, StructureDefinition>();

  for (const definition of definitions) {
    if (definition.derivation === 'constraint') {
      continue;
    }

    if (!definition.snapshot?.element?.length) {
      continue;
    }

    if (definition.kind !== 'resource' && definition.kind !== 'complex-type') {
      continue;
    }

    const typeName = pascalIdentifier(definition.type || definition.name);

    if (!typeName) {
      continue;
    }

    byType.set(typeName, definition);
  }

  return [...byType.values()].sort((a, b) => {
    const left = pascalIdentifier(a.type || a.name);
    const right = pascalIdentifier(b.type || b.name);
    return left.localeCompare(right);
  });
}

function generateReleaseIndex(release: string, definitions: StructureDefinition[]): string {
  const knownTypes = new Set<string>();

  for (const definition of definitions) {
    knownTypes.add(pascalIdentifier(definition.type || definition.name));
  }

  const context: GenerationContext = {
    knownTypes,
    backbonePathNames: new Map<string, string>(),
    missingTypes: new Set<string>(),
  };

  for (const definition of definitions) {
    registerBackboneTypes(definition, context);
  }

  const chunks: string[] = [];

  chunks.push(
    [
      '/* eslint-disable */',
      `// Generated by scripts/generate.ts for FHIR ${release.toUpperCase()}.`,
      '// Do not edit this file manually.',
      '',
    ].join('\n')
  );

  for (const definition of definitions) {
    chunks.push(generateStructureDefinition(definition, context));
  }

  const resourceNames = definitions
    .filter((definition) => definition.kind === 'resource' && !definition.abstract)
    .map((definition) => pascalIdentifier(definition.type || definition.name))
    .filter(Boolean)
    .sort();

  if (resourceNames.length > 0) {
    chunks.push(
      [
        'export type ResourceType =',
        ...resourceNames.map((name, index) => {
          const separator = index === resourceNames.length - 1 ? ';' : '';
          return `  | "${name}"${separator}`;
        }),
      ].join('\n')
    );

    chunks.push(
      [
        'export type AnyResource =',
        ...resourceNames.map((name, index) => {
          const separator = index === resourceNames.length - 1 ? ';' : '';
          return `  | ${name}${separator}`;
        }),
      ].join('\n')
    );
  } else {
    chunks.push('export type ResourceType = string;');
    chunks.push('export type AnyResource = Resource;');
  }

  if (context.missingTypes.size > 0) {
    const missing = [...context.missingTypes].sort();

    chunks.push(
      [
        '/**',
        ' * Some referenced FHIR types were not present in the input file.',
        ' * They were emitted as unknown in field positions.',
        ' * Use the full definitions.json.zip file for stronger generated types.',
        ' *',
        ...missing.slice(0, 50).map((typeName) => ` * - ${typeName}`),
        missing.length > 50 ? ` * - ...and ${missing.length - 50} more` : '',
        ' */',
        'export type MissingGeneratedFHIRTypes = never;',
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  return chunks.join('\n\n');
}

function registerBackboneTypes(definition: StructureDefinition, context: GenerationContext): void {
  const rootPath = definition.type || definition.name;
  const rootName = pascalIdentifier(rootPath);
  const elements = definition.snapshot?.element ?? [];
  const parentPaths = new Set<string>();

  for (const element of elements) {
    parentPaths.add(parentPathOf(element.path));
  }

  for (const element of elements) {
    if (!element.path.startsWith(`${rootPath}.`)) {
      continue;
    }

    const hasChildren = parentPaths.has(element.path);
    const isBackbone = element.type?.some((type) => backboneCodes.has(type.code)) ?? false;

    if (hasChildren && isBackbone) {
      const name = interfaceNameForPath(rootName, rootPath, element.path);
      context.backbonePathNames.set(element.path, name);
      context.knownTypes.add(name);
    }
  }
}

function generateStructureDefinition(
  definition: StructureDefinition,
  context: GenerationContext
): string {
  const rootPath = definition.type || definition.name;
  const rootName = pascalIdentifier(rootPath);
  const elements = definition.snapshot?.element ?? [];

  const parentPaths = [
    rootPath,
    ...[...context.backbonePathNames.keys()]
      .filter((pathName) => pathName.startsWith(`${rootPath}.`))
      .sort((a, b) => a.split('.').length - b.split('.').length || a.localeCompare(b)),
  ];

  return parentPaths
    .map((parentPath) => generateInterfaceForPath(definition, parentPath, context, elements))
    .join('\n\n');
}

function generateInterfaceForPath(
  definition: StructureDefinition,
  parentPath: string,
  context: GenerationContext,
  elements: ElementDefinition[]
): string {
  const rootPath = definition.type || definition.name;
  const rootName = pascalIdentifier(rootPath);
  const interfaceName =
    parentPath === rootPath
      ? rootName
      : (context.backbonePathNames.get(parentPath) ??
        interfaceNameForPath(rootName, rootPath, parentPath));

  const directChildren = elements.filter((element) => {
    if (element.path === parentPath) {
      return false;
    }

    return parentPathOf(element.path) === parentPath;
  });

  const lines: string[] = [];

  if (parentPath === rootPath && definition.kind === 'resource') {
    if (definition.abstract) {
      lines.push('  resourceType?: string;');
    } else {
      lines.push(`  resourceType: "${rootName}";`);
    }
  }

  const emitted = new Set<string>();

  for (const child of directChildren) {
    const props = renderElementProperties(rootPath, child, context);

    for (const prop of props) {
      if (emitted.has(prop.name)) {
        continue;
      }

      emitted.add(prop.name);

      if (prop.comment) {
        lines.push(...renderJsDoc(prop.comment, '  '));
      }

      lines.push(`  ${propertyKey(prop.name)}${prop.optional ? '?' : ''}: ${prop.type};`);
    }
  }

  if (lines.length === 0) {
    lines.push('  [key: string]: unknown;');
  }

  return `export interface ${interfaceName} {\n${lines.join('\n')}\n}`;
}

interface RenderedProperty {
  name: string;
  type: string;
  optional: boolean;
  comment?: string;
}

function renderElementProperties(
  rootPath: string,
  element: ElementDefinition,
  context: GenerationContext
): RenderedProperty[] {
  const rawName = lastPathSegment(element.path);
  const optional = (element.min ?? 0) === 0;
  const isArray = element.max === '*';
  const comment = element.short || element.definition;

  if (rawName === 'resourceType') {
    return [];
  }

  if (rawName.endsWith('[x]')) {
    const baseName = rawName.slice(0, -3);
    const choiceTypes = element.type ?? [];

    return choiceTypes.flatMap((choiceType) => {
      const fieldName = `${baseName}${choiceSuffix(choiceType.code)}`;
      const type = applyArray(tsTypeForCode(choiceType.code, context), isArray);
      const props: RenderedProperty[] = [
        {
          name: fieldName,
          type,
          optional,
          comment,
        },
      ];

      if (primitiveCodes.has(choiceType.code)) {
        props.push({
          name: `_${fieldName}`,
          type: applyArray('Element', isArray),
          optional: true,
          comment: `Primitive element metadata for ${fieldName}.`,
        });
      }

      return props;
    });
  }

  const childBackboneType = context.backbonePathNames.get(element.path);

  let type: string;

  if (childBackboneType) {
    type = childBackboneType;
  } else if (element.contentReference) {
    type = typeForContentReference(rootPath, element.contentReference, context);
  } else {
    type = typeForElement(element, context);
  }

  const props: RenderedProperty[] = [
    {
      name: rawName,
      type: applyArray(type, isArray),
      optional,
      comment,
    },
  ];

  if (hasPrimitiveType(element)) {
    props.push({
      name: `_${rawName}`,
      type: applyArray('Element', isArray),
      optional: true,
      comment: `Primitive element metadata for ${rawName}.`,
    });
  }

  return props;
}

function typeForElement(element: ElementDefinition, context: GenerationContext): string {
  const types = element.type ?? [];

  if (types.length === 0) {
    return 'unknown';
  }

  const rendered = unique(types.map((type) => tsTypeForCode(type.code, context)));

  if (rendered.length === 1) {
    return rendered[0];
  }

  return rendered.join(' | ');
}

function tsTypeForCode(code: string, context: GenerationContext): string {
  const primitive = primitiveTypeMap.get(code);

  if (primitive) {
    return primitive;
  }

  if (code === '*') {
    return 'unknown';
  }

  if (code.startsWith('http://hl7.org/fhir/StructureDefinition/')) {
    const name = pascalIdentifier(code.slice('http://hl7.org/fhir/StructureDefinition/'.length));

    if (context.knownTypes.has(name)) {
      return name;
    }

    context.missingTypes.add(name);
    return 'unknown';
  }

  const name = pascalIdentifier(code);

  if (context.knownTypes.has(name)) {
    return name;
  }

  // Some FHIR definitions use Resource before every concrete resource union exists.
  if (name === 'Resource') {
    return 'Resource';
  }

  context.missingTypes.add(name);
  return 'unknown';
}

function typeForContentReference(
  rootPath: string,
  contentReference: string,
  context: GenerationContext
): string {
  if (!contentReference.startsWith('#')) {
    return 'unknown';
  }

  const referencedPath = contentReference.slice(1);

  if (context.backbonePathNames.has(referencedPath)) {
    return context.backbonePathNames.get(referencedPath)!;
  }

  if (referencedPath.startsWith(`${rootPath}.`)) {
    const rootName = pascalIdentifier(rootPath);
    const name = interfaceNameForPath(rootName, rootPath, referencedPath);
    context.knownTypes.add(name);
    return name;
  }

  return 'unknown';
}

function hasPrimitiveType(element: ElementDefinition): boolean {
  return element.type?.some((type) => primitiveCodes.has(type.code)) ?? false;
}

function applyArray(type: string, isArray: boolean): string {
  if (!isArray) {
    return type;
  }

  if (type.includes(' | ')) {
    return `Array<${type}>`;
  }

  return `${type}[]`;
}

function parentPathOf(fhirPath: string): string {
  const parts = fhirPath.split('.');

  if (parts.length <= 1) {
    return '';
  }

  return parts.slice(0, -1).join('.');
}

function lastPathSegment(fhirPath: string): string {
  return fhirPath.split('.').at(-1) ?? fhirPath;
}

function interfaceNameForPath(rootName: string, rootPath: string, fhirPath: string): string {
  const suffix = fhirPath
    .slice(rootPath.length + 1)
    .split('.')
    .map((part) => part.replace('[x]', ''))
    .map(pascalIdentifier)
    .join('');

  return `${rootName}${suffix}`;
}

function choiceSuffix(code: string): string {
  const cleaned = code
    .replace('http://hl7.org/fhir/StructureDefinition/', '')
    .replace('http://hl7.org/fhirpath/System.', '');

  return pascalIdentifier(cleaned);
}

function pascalIdentifier(value: string): string {
  const cleaned = value
    .replace(/\[x\]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim();

  if (!cleaned) {
    return 'Unknown';
  }

  const result = cleaned
    .split(/\s+/)
    .map((part) => {
      if (!part) {
        return '';
      }

      return part[0]!.toUpperCase() + part.slice(1);
    })
    .join('');

  if (/^[0-9]/.test(result)) {
    return `FHIR${result}`;
  }

  return result;
}

function propertyKey(value: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function renderJsDoc(value: string, indent = ''): string[] {
  const clean = value.replace(/\*\//g, '*\\/').replace(/\s+/g, ' ').trim();

  if (!clean) {
    return [];
  }

  if (clean.length <= 120) {
    return [`${indent}/** ${clean} */`];
  }

  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (`${current} ${word}`.trim().length > 100) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }

  if (current) {
    lines.push(current);
  }

  return [`${indent}/**`, ...lines.map((line) => `${indent} * ${line}`), `${indent} */`];
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function namespaceForRelease(release: string): string {
  return release
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^r\d/i.test(part)) {
        return part.toUpperCase();
      }

      return pascalIdentifier(part);
    })
    .join('');
}

async function writeRootIndex(outRoot: string): Promise<void> {
  await mkdir(outRoot, {
    recursive: true,
  });

  const entries = await readdir(outRoot, {
    withFileTypes: true,
  });

  const releaseDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const lines = releaseDirs.map((releaseDir) => {
    return `export * as ${namespaceForRelease(releaseDir)} from "./${releaseDir}/index.js";`;
  });

  const base = path.resolve(outRoot);
  const target = path.resolve(base, 'index.ts');
  const relative = path.relative(base, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid file path');
  }
  await writeFile(target, `${lines.join('\n')}\n`, 'utf8');
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const definitions = getBaseDefinitions(await collectStructureDefinitions(options.file));

  if (definitions.length === 0) {
    throw new Error(`No base FHIR StructureDefinition resources found in ${options.file}`);
  }

  const releaseDir = path.join(options.outRoot, options.release);

  await rm(releaseDir, {
    recursive: true,
    force: true,
  });

  await mkdir(releaseDir, {
    recursive: true,
  });

  const output = generateReleaseIndex(options.release, definitions);

  await writeFile(path.join(releaseDir, 'index.ts'), output, 'utf8');
  await writeRootIndex(options.outRoot);

  console.log(`Generated ${definitions.length} FHIR definitions for ${options.release}.`);
  console.log(`Output: ${path.join(releaseDir, 'index.ts')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

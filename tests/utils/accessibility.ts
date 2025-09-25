import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from '@astrojs/compiler';
import { expect } from 'vitest';

type AttributeExpectation = {
  name: string;
  value?: string | RegExp;
  expressionContains?: string;
};

type AstroAttribute = {
  type?: string;
  name?: string;
  value?:
    | string
    | Array<{
        type: string;
        value?: string;
      }>;
};

type AstroElement = {
  type?: string;
  name?: string;
  attributes?: AstroAttribute[];
  children?: unknown;
};

type AstroRoot = {
  children?: unknown;
};

const repoRoot = process.cwd();

/* eslint-disable-next-line no-unused-vars */
type ElementPredicate = (...args: [AstroElement]) => boolean;

export async function loadAstroAst(relativePath: string): Promise<AstroRoot> {
  const absolutePath = path.join(repoRoot, relativePath);
  // We only allow reading from the repository root; callers pass relative paths checked into source
  // control, so suppress the false positive from eslint-plugin-security.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const source = await readFile(absolutePath, 'utf-8');
  const { ast, diagnostics } = await parse(source, { position: true });

  expect(diagnostics, `Astro compiler diagnostics for ${relativePath}`).toEqual([]);
  return ast as AstroRoot;
}

function isElementNode(node: unknown): node is AstroElement {
  return typeof node === 'object' && node !== null && (node as AstroElement).type === 'element';
}

function flattenElements(node: unknown, predicate: ElementPredicate, bucket: AstroElement[]): void {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      flattenElements(child, predicate, bucket);
    }
    return;
  }

  if (isElementNode(node)) {
    if (predicate(node)) {
      bucket.push(node);
    }

    if (node.children) {
      flattenElements(node.children, predicate, bucket);
    }
  } else if (typeof node === 'object' && node !== null) {
    const typedNode = node as { children?: unknown };
    if (typedNode.children) {
      flattenElements(typedNode.children, predicate, bucket);
    }
  }
}

export async function collectAstroElementsByName(
  relativePath: string,
  elementName: string,
): Promise<AstroElement[]> {
  const ast = await loadAstroAst(relativePath);
  const matches: AstroElement[] = [];
  flattenElements(ast.children, (node) => node.name === elementName, matches);
  return matches;
}

export function getAstroAttributeValue(
  node: AstroElement,
  attributeName: string,
): string | undefined {
  const attributes = (node.attributes ?? []) as AstroAttribute[];
  const attribute = attributes.find((item) => item.name === attributeName);
  if (!attribute || attribute.type !== 'attribute') {
    return undefined;
  }

  if (typeof attribute.value === 'string') {
    return attribute.value;
  }

  if (Array.isArray(attribute.value)) {
    return attribute.value
      .map((segment) => ('value' in segment && segment.value ? segment.value : ''))
      .join('');
  }

  return undefined;
}

export async function expectAstroElementAttributes(
  relativePath: string,
  elementName: string,
  ...attributeExpectations: AttributeExpectation[]
): Promise<void> {
  const ast = await loadAstroAst(relativePath);
  const matches: AstroElement[] = [];

  flattenElements(ast.children, (node) => node.name === elementName, matches);

  expect(matches.length, `Expected to find <${elementName}> in ${relativePath}`).toBeGreaterThan(0);

  for (const expectation of attributeExpectations) {
    const attrName = expectation.name;
    const matchedElement = matches.find((candidate) =>
      (candidate.attributes ?? []).some((attribute) => attribute.name === attrName),
    );

    expect(
      matchedElement,
      `No element <${elementName}> with attribute ${attrName} found in ${relativePath}`,
    ).toBeDefined();

    if (!matchedElement) {
      throw new Error(
        `No element <${elementName}> with attribute ${attrName} found in ${relativePath}`,
      );
    }

    const attributes = (matchedElement.attributes ?? []) as AstroAttribute[];
    const attribute = attributes.find((item) => item.name === attrName);
    if (!attribute || attribute.type !== 'attribute') {
      throw new Error(`Attribute ${attrName} missing or unsupported in ${relativePath}`);
    }

    if (expectation.value !== undefined) {
      const normalizedValue = Array.isArray(attribute.value)
        ? attribute.value
            .map((segment) =>
              segment.type === 'text'
                ? (segment.value ?? '')
                : segment.type === 'expression'
                  ? (segment.value ?? '')
                  : '',
            )
            .join('')
        : typeof attribute.value === 'string'
          ? attribute.value
          : '';

      if (expectation.value instanceof RegExp) {
        expect(normalizedValue).toMatch(expectation.value);
      } else {
        expect(normalizedValue).toBe(expectation.value);
      }
    }

    if (expectation.expressionContains) {
      const serialized = Array.isArray(attribute.value)
        ? attribute.value
            .map((segment) => ('value' in segment && segment.value ? segment.value : ''))
            .join('')
        : typeof attribute.value === 'string'
          ? attribute.value
          : '';
      expect(serialized).toContain(expectation.expressionContains);
    }
  }
}

export function collectLandmarkRoles(root: ParentNode): string[] {
  const walker = (node: Node, roles: string[]) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const role = element.getAttribute('role');
      if (role) {
        roles.push(role);
      } else if (element.tagName.toLowerCase() === 'main') {
        roles.push('main');
      } else if (element.tagName.toLowerCase() === 'header') {
        roles.push('banner');
      } else if (element.tagName.toLowerCase() === 'footer') {
        roles.push('contentinfo');
      }
    }

    node.childNodes.forEach((child) => walker(child, roles));
    return roles;
  };

  return walker(root as unknown as Node, []);
}

export function expectLandmarkSequence(root: ParentNode, expected: string[]): void {
  const roles = collectLandmarkRoles(root);
  expect(roles).toEqual(expect.arrayContaining(expected));
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const projectsDataPath = path.join(repoRoot, 'src', 'app', 'data', 'projects.data.ts');
const publicDir = path.join(repoRoot, 'public');

const baseUrl = 'https://tatotopuria.vercel.app';
const sitemapPath = path.join(publicDir, 'sitemap.xml');
const robotsPath = path.join(publicDir, 'robots.txt');

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function getPropertyName(nameNode) {
  if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode)) {
    return nameNode.text;
  }

  return null;
}

function getStringInitializer(property) {
  return ts.isStringLiteral(property.initializer) ? property.initializer.text : null;
}

function extractProjectSlugs(sourceFile) {
  const slugs = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    const isProjectsExport = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );

    if (!isProjectsExport) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'PROJECTS') {
        continue;
      }

      const initializer = declaration.initializer;
      if (!initializer || !ts.isArrayLiteralExpression(initializer)) {
        throw new Error('PROJECTS export is not an array literal.');
      }

      for (const element of initializer.elements) {
        if (!ts.isObjectLiteralExpression(element)) {
          continue;
        }

        const slugProperty = element.properties.find(
          (property) =>
            ts.isPropertyAssignment(property) && getPropertyName(property.name) === 'slug',
        );

        if (!slugProperty || !ts.isPropertyAssignment(slugProperty)) {
          continue;
        }

        const slug = getStringInitializer(slugProperty);
        if (slug) {
          slugs.push(slug);
        }
      }
    }
  }

  return slugs;
}

function buildSitemapXml(projectSlugs) {
  const urls = [
    { path: '/', changefreq: 'monthly', priority: '1.0' },
    ...projectSlugs.map((slug) => ({
      path: `/projects/${slug}`,
      changefreq: 'monthly',
      priority: '0.8',
    })),
  ];

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.flatMap((entry) => [
      '  <url>',
      `    <loc>${escapeXml(`${baseUrl}${entry.path}`)}</loc>`,
      `    <changefreq>${entry.changefreq}</changefreq>`,
      `    <priority>${entry.priority}</priority>`,
      '  </url>',
    ]),
    '</urlset>',
    '',
  ];

  return lines.join('\n');
}

function buildRobotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /404',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

async function main() {
  const sourceText = await readFile(projectsDataPath, 'utf8');
  const sourceFile = ts.createSourceFile(
    projectsDataPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const projectSlugs = extractProjectSlugs(sourceFile);

  if (projectSlugs.length === 0) {
    throw new Error('No project slugs were found in projects.data.ts.');
  }

  await mkdir(publicDir, { recursive: true });
  await writeFile(sitemapPath, buildSitemapXml(projectSlugs), 'utf8');
  await writeFile(robotsPath, buildRobotsTxt(), 'utf8');

  console.log(`Generated sitemap for ${projectSlugs.length + 1} routes.`);
}

await main();
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const expected = [
  'index.html',
  ...Array.from({ length: 8 }, (_, index) => `algorithms/${String(index + 1).padStart(2, '0')}-${[
    'held-draft', 'ticket-sequencer', 'coagent', 'latte', 'syncplan', 'atomix', 'cordon', 'tracefix',
  ][index]}.html`),
];
const errors = [];

for (const relative of expected) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    errors.push(`Missing required page: ${relative}`);
    continue;
  }
  const html = fs.readFileSync(absolute, 'utf8');
  const required = [
    ['Chinese document language', /<html[^>]+lang="zh-CN"/],
    ['viewport meta', /<meta[^>]+name="viewport"/],
    ['skip link', /class="skip-link"/],
    ['single main landmark', /<main\b/],
    ['page heading', /<h1\b/],
    ['page title', /<title>[^<]+<\/title>/],
  ];
  for (const [label, pattern] of required) {
    if (!pattern.test(html)) errors.push(`${relative}: missing ${label}`);
  }
  if (/<\w+[^>]+tabindex="[1-9]/.test(html)) errors.push(`${relative}: positive tabindex is not allowed`);

  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const link = match[1];
    if (/^(?:https?:|mailto:|data:)/.test(link)) continue;
    const target = path.resolve(path.dirname(absolute), link.split('?')[0]);
    if (!fs.existsSync(target)) errors.push(`${relative}: broken local reference ${link}`);
  }
}

const css = fs.readFileSync(path.join(root, 'assets/site.css'), 'utf8');
if (/transition\s*:\s*all\b/.test(css)) errors.push('site.css: transition: all is not allowed');
if (!css.includes(':focus-visible')) errors.push('site.css: missing visible keyboard focus');
if (!css.includes('prefers-reduced-motion')) errors.push('site.css: missing reduced-motion support');

if (errors.length) {
  console.error(`Validation failed (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${expected.length} HTML pages and shared accessibility rules.`);

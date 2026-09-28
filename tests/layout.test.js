const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const html = readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
const renderer = readFileSync(path.join(__dirname, '../src/renderer.js'), 'utf8');

test('header keeps the title, three centered page links and an Obsidian route', () => {
  const header = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)?.[1];
  assert.ok(header, 'header exists');
  assert.match(header, /<h1>FocusDesk<\/h1>/);
  for (const page of ['tasks', 'timer', 'stats', 'obsidian']) {
    assert.match(header, new RegExp(`href="#${page}"[^>]*data-page-link="${page}"`));
  }
  assert.doesNotMatch(header, /Plan what matters|YOUR SPACE|A QUIETER WAY/);
  assert.match(renderer, /\['tasks', 'timer', 'stats', 'obsidian'\]/);
});

test('vault settings live on the Obsidian page, not above Tasks', () => {
  const page = html.match(/<section class="page" id="obsidian"[\s\S]*?<\/section>/)?.[0];
  assert.ok(page, 'Obsidian page exists');
  for (const id of ['vault-label', 'choose-vault', 'pending', 'retry', 'vault-message']) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  const tasks = html.match(/<section class="page" id="tasks"[\s\S]*?<\/section>/)?.[0];
  assert.ok(tasks, 'Tasks page exists');
  assert.doesNotMatch(tasks, /vault-panel|vault-label|choose-vault|YOUR SPACE/);
});

test('Timer and Stats retain their headings without introductory descriptions', () => {
  const timer = html.match(/<section class="page" id="timer"[\s\S]*?<\/section>/)?.[0];
  const stats = html.match(/<section class="page" id="stats"[\s\S]*?<\/section>/)?.[0];
  assert.ok(timer && stats);
  assert.match(timer, /<h2>Timer<\/h2>/);
  assert.match(timer, /id="focus-clock"/);
  assert.doesNotMatch(timer, /Set your pace, then begin\./);
  assert.match(stats, /id="stats-heading"/);
  assert.match(stats, /id="report-bars"/);
  assert.doesNotMatch(stats, /id="stats-subtitle"|See where your focus time went\./);
  assert.doesNotMatch(renderer, /#stats-subtitle/);
});

test('Tasks offers a group form, an ungrouped task choice, and independent group filters', () => {
  const tasks = html.match(/<section class="page" id="tasks"[\s\S]*?<\/section>/)?.[0];
  assert.ok(tasks);
  for (const id of ['open-group-form', 'group-form', 'group-name', 'task-group', 'group-filters', 'task-tabs']) {
    assert.match(tasks, new RegExp(`id="${id}"`));
  }
  assert.match(tasks, /Add a new group/);
  assert.match(tasks, /Add to a group/);
  assert.match(tasks, /<option value="">Ungrouped<\/option>/);
  assert.match(tasks, /data-group-filter="all"/);
  assert.match(renderer, /createGroup/);
});

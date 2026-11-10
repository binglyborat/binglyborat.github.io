import { normalizeState } from './storage.js';

export const BUILTIN_FIELDS = [
  ['name', 'School'], ['country', 'Country'], ['city', 'City'], ['region', 'Region'],
  ['departmentNotes', 'Department notes'],
  ['degree', 'Degree'], ['institutionName', 'University / institution'], ['programType', 'Program type'], ['programFormat', 'Program structure'], ['award', 'Degree award'], ['duration', 'Program duration'], ['structure', 'Curriculum & assessment'], ['program', 'Program'], ['areas', 'Research areas'], ['faculty', 'Faculty'], ['facultyEvidence', 'Faculty research & evidence'],
  ['rank', 'Rank'], ['rankSource', 'Rank source'], ['rankNote', 'Ranking evidence'], ['setting', 'Setting'], ['schoolSize', 'School size'], ['size', 'School and cohort size details'],
  ['deadline', 'Deadline date'], ['deadlineDetails', 'Deadline rules & evidence'], ['funding', 'Funding'], ['admissions', 'Admissions'],
  ['international', 'International students'], ['fees', 'Application fees'], ['requirements', 'Requirements'],
  ['costs', 'Costs & fees'], ['greGeneral', 'GRE General'], ['greMath', 'GRE Mathematics'],
  ['letters', 'Recommendation letters'], ['writing', 'Written materials'], ['checks', 'Checks still needed'],
  ['enrollmentTotal', 'Enrollment total'], ['enrollmentYear', 'Enrollment year'],
  ['enrollmentScope', 'Enrollment scope'], ['enrollmentSource', 'Enrollment source'],
  ['committeeMembers', 'Admissions committee / published roles'], ['committeeEvidence', 'Committee dates & evidence'],
  ['selectedConnections', 'Connections to people I know'],
  ['coauthorConnections', 'Coauthored papers with people I know'],
  ['mentorshipConnections', 'Adviser and student connections'], ['knownProfessors', 'People I selected'],
  ['matchingConnections', 'Connections used for matching'], ['matchingProfessors', 'Professors used for matching'],
  ['eventConnections','Joint academic event organization'], ['networkCoverage', 'Connection research coverage'], ['independentSources', 'Independent research sources'],
  ['url', 'Program website'], ['sources', 'Sources'], ['decision', 'My decision'], ['flagged', 'Flagged'],
  ['applicationStatus', 'Application status'], ['notes', 'My notes'],
].map(([key, label]) => ({ key, label }));

export const PRESETS = {
  application: {
    label: 'Applications', description: 'Deadlines, letters, fees, requirements, and your progress.',
    fields: ['name', 'program', 'programType', 'duration', 'country', 'city', 'deadline', 'deadlineDetails', 'letters', 'committeeMembers', 'committeeEvidence', 'fees', 'greGeneral', 'greMath', 'writing', 'funding', 'international', 'applicationStatus', 'notes', 'url', 'independentSources'],
  },
  research: {
    label: 'Compare programs', description: 'Research areas, faculty, school size, location, and funding.',
    fields: ['name', 'program', 'programType', 'duration', 'country', 'city', 'departmentNotes', 'areas', 'faculty', 'facultyEvidence', 'setting', 'schoolSize', 'enrollmentTotal', 'enrollmentYear', 'enrollmentScope', 'enrollmentSource', 'funding', 'international', 'decision', 'flagged', 'notes', 'independentSources'],
  },
  connections: {
    label: 'Faculty connections', description: 'Selected people, coauthors, adviser and student relationships, and committee evidence.',
    fields: ['name', 'faculty', 'knownProfessors', 'selectedConnections', 'matchingProfessors', 'matchingConnections', 'networkCoverage', 'committeeMembers', 'committeeEvidence', 'letters', 'deadlineDetails', 'notes', 'independentSources'],
  },
};

/** A preset changes standard columns without dropping selected personal/report data. */
export function applyExportPreset(selected, key) {
  const preset = PRESETS[key];
  if (!preset) return [...selected];
  return [...new Set([...preset.fields, ...selected.filter(field => field.startsWith('custom:') || field.startsWith('dossier:'))])];
}

export function moveExportField(selected, key, direction) {
  const fields = [...selected], index = fields.indexOf(key), step = Number(direction);
  if (index < 0 || ![-1, 1].includes(step)) return fields;
  const target = index + step;
  if (target < 0 || target >= fields.length) return fields;
  [fields[index], fields[target]] = [fields[target], fields[index]];
  return fields;
}

export function readable(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(readable).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    if (value.name) return [value.name, value.role, value.status, value.areas?.join(', '), value.url].filter(Boolean).join(' — ');
    return Object.entries(value).map(([key, entry]) => `${key}: ${readable(entry)}`).join('; ');
  }
  return String(value);
}

/** Shared by the sheet preview and CSV so displayed values match downloaded values. */
export function exportValue(school, state, key) {
  const record = state.records[school.id] ?? {};
  if (key.startsWith('custom:')) return record.custom?.[key.slice(7)];
  if (key.startsWith('dossier:')) return school.researchFields?.[key.slice(8)];
  if (key === 'flagged') return record.flagged ? 'Yes' : 'No';
  if (key === 'decision') return record.decision ?? 'unreviewed';
  if (['notes', 'applicationStatus'].includes(key)) return record[key];
  if (key === 'fees') return school.fees ?? school.costs;
  if (key === 'url') return school.url ?? school.links?.[0]?.url;
  if (key === 'requirements') return school.requirements ?? school.admissions;
  if (key === 'departmentNotes') return school.departmentNotes ? `${school.departmentNotes.paragraphs.join('\n\n')}\n\nSources:\n${school.departmentNotes.sources.map(source=>`${source.label}: ${source.url}`).join('\n')}` : '';
  return school[key];
}

/** Always quote cells; neutralize spreadsheet formulas even after leading whitespace. */
export function csvCell(value) {
  let text = readable(value);
  if (/^[\s\uFEFF]*[=+@\-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Custom field keys use `custom:<id>`. The caller chooses which schools to export. */
export function buildCSV(schools, state, fieldKeys = state.fields.selected) {
  const fields = [
    ...BUILTIN_FIELDS,
    ...(state.fields.custom ?? []).map((field) => ({ key: `custom:${field.id}`, label: field.label })),
    ...fieldKeys.filter((key) => key.startsWith('dossier:')).map((key) => ({ key, label: key.slice(8) })),
  ];
  const selected = [...new Set(fieldKeys)].map((key) => fields.find((field) => field.key === key)).filter(Boolean);
  if (!selected.length) throw new Error('Choose at least one export column.');
  const lines = [selected.map((field) => csvCell(field.label)).join(',')];
  for (const school of schools) {
    lines.push(selected.map(({ key }) => csvCell(exportValue(school, state, key))).join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

export function serializeBackup(state) {
  return JSON.stringify({ format: 'math-match-backup', version: 1, exportedAt: new Date().toISOString(), state: normalizeState(state) }, null, 2);
}

export function parseBackup(text) {
  if (text.length > 10_000_000) throw new Error('Backup is too large (maximum 10 MB).');
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error('This file is not valid JSON. Choose a downloaded Math Grad Tinder backup.'); }
  if (backup?.format !== 'math-match-backup' || backup.version !== 1 || !backup.state || typeof backup.state !== 'object') {
    throw new Error('This is not a supported Math Grad Tinder backup.');
  }
  const state = backup.state;
  const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
  if (state.version !== 1 || !isObject(state.prefs) || !isObject(state.records) || !isObject(state.fields)
      || !Array.isArray(state.fields.selected) || !Array.isArray(state.fields.custom)
      || state.fields.selected.some((key) => typeof key !== 'string')
      || Object.values(state.records).some((record) => !isObject(record)
        || !['saved', 'passed', 'unreviewed'].includes(record.decision)
        || typeof record.flagged !== 'boolean' || typeof record.notes !== 'string' || !isObject(record.custom))) {
    throw new Error('The backup is incomplete or uses an unsupported version.');
  }
  return normalizeState(state);
}

export function downloadFile(text, filename, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

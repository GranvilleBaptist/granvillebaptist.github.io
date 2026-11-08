const requests = new Map();

export function contentError(file, line, message) {
  const error = new Error(`${file}, line ${line}: ${message}`);
  error.file = file;
  error.line = line;
  return error;
}

// Shared by all content files. Comments and blank lines remain editor-friendly;
// quoted commas, escaped quotes and quoted paragraphs use normal CSV rules.
export function parseCSV(input, { file = 'Content file' } = {}) {
  const text = String(input).replace(/^\uFEFF/, '');
  const rows = [];
  let fields = [], value = '', quoted = false, closedQuote = false;
  let line = 1, rowLine = 1;
  const finishField = () => {
    fields.push(value.trim());
    value = '';
    closedQuote = false;
  };
  const finishRow = () => {
    finishField();
    if (fields.some(field => field !== '')) rows.push({ fields, line: rowLine });
    fields = [];
  };
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') { value += '"'; index++; }
        else { quoted = false; closedQuote = true; }
      } else if (character === '\r' || character === '\n') {
        if (character === '\r' && text[index + 1] === '\n') index++;
        value += '\n';
        line++;
      } else value += character;
      continue;
    }
    if (!fields.length && !value.trim() && character === '#') {
      while (index < text.length && !/[\r\n]/.test(text[index])) index++;
      if (index < text.length) {
        if (text[index] === '\r' && text[index + 1] === '\n') index++;
        line++;
      }
      value = '';
      rowLine = line;
      continue;
    }
    if (character === ',') { finishField(); continue; }
    if (character === '\r' || character === '\n') {
      finishRow();
      if (character === '\r' && text[index + 1] === '\n') index++;
      line++;
      rowLine = line;
      continue;
    }
    if (character === '"') {
      if (value.trim() || closedQuote) throw contentError(file, line, 'Put quotation marks around the entire field.');
      value = '';
      quoted = true;
      continue;
    }
    if (closedQuote && character.trim()) throw contentError(file, line, 'Add a comma after the closing quotation mark.');
    value += character;
  }
  if (quoted) throw contentError(file, rowLine, 'Close the quotation marks for this entry.');
  finishRow();
  return rows;
}

export function loadText(url) {
  const key = String(url);
  if (!requests.has(key)) {
    requests.set(key, fetch(url, { cache: 'no-cache' }).then(response => {
      if (!response.ok) throw new Error(`Could not load ${new URL(key).pathname} (${response.status}).`);
      return response.text();
    }).catch(error => { requests.delete(key); throw error; }));
  }
  return requests.get(key);
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

export function reportContentError(file, error, root = document) {
  console.error(file, error);
  const container = root.querySelector('main');
  if (!container) return;
  let alert = Array.from(container.querySelectorAll('[data-content-error]')).find(element => element.dataset.contentError === file);
  if (!alert) {
    alert = root.createElement('p');
    alert.dataset.contentError = file;
    alert.setAttribute('role', 'alert');
    container.prepend(alert);
  }
  alert.textContent = `Content could not be loaded: ${error?.message || file}`;
}

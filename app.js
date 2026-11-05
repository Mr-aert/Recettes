const CATEGORY_ICONS = {
  LAITS: '🥛',
  MALADIE: '🌿',
  PATES: '🥧',
  SALEES: '🍲',
  SOUPES: '🍵',
  SUCREES: '🍰',
  Autres: '🍽️',
};

const state = {
  recipes: [],
  category: 'Toutes',
  selectedPath: '',
  expandedDirectories: new Set(),
  initializedDirectories: new Set(),
};

const categoriesElement = document.querySelector('#categories');
const listElement = document.querySelector('#recipe-list');
const searchElement = document.querySelector('#search');
const contentElement = document.querySelector('#recipe-content');
const welcomeElement = document.querySelector('#welcome');
const statusElement = document.querySelector('#sync-status');
const statusDot = document.querySelector('.live-dot');
const themeToggle = document.querySelector('#theme-toggle');
const textMeasureCanvas = document.createElement('canvas');
const textMeasureContext = textMeasureCanvas.getContext('2d');

function setTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? 'Activer le thème clair' : 'Activer le thème sombre');
  themeToggle.firstElementChild.textContent = isDark ? '☀' : '☾';
  document.querySelector('meta[name="theme-color"]').content = isDark ? '#20221f' : '#f7f5ef';
}

let initialTheme = 'light';
try {
  initialTheme = localStorage.getItem('recipe-theme') === 'dark' ? 'dark' : 'light';
} catch (error) {
  console.warn('Impossible de lire le thème enregistré.', error);
}
setTheme(initialTheme);

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  try {
    localStorage.setItem('recipe-theme', theme);
  } catch (error) {
    console.warn('Impossible d’enregistrer le thème choisi.', error);
  }
});

function visibleRecipes() {
  const query = searchElement.value.trim().toLocaleLowerCase('fr');
  return state.recipes.filter((recipe) => {
    const matchesCategory = state.category === 'Toutes'
      || (state.category === 'Autres'
        ? recipe.category === 'Autres'
        : recipe.path.startsWith(`${state.category}/`));
    const matchesQuery = !query || `${recipe.title} ${recipe.path}`.toLocaleLowerCase('fr').includes(query);
    return matchesCategory && matchesQuery;
  });
}

function directoryTree() {
  const roots = new Map();
  for (const recipe of state.recipes) {
    const directories = recipe.path.split('/').slice(0, -1);
    if (!directories.length) directories.push('Autres');
    let siblings = roots;
    let directoryPath = '';
    for (const name of directories) {
      directoryPath = directoryPath ? `${directoryPath}/${name}` : name;
      if (!siblings.has(name)) {
        siblings.set(name, { name, path: directoryPath, count: 0, children: new Map() });
      }
      const directory = siblings.get(name);
      directory.count += 1;
      siblings = directory.children;
    }
  }
  return roots;
}

function renderDirectory(directory, depth) {
  const entry = document.createElement('div');
  entry.className = 'category-entry';
  const row = document.createElement('div');
  row.className = 'category-row';
  const button = document.createElement('button');
  button.className = `category-button${state.category === directory.path ? ' active' : ''}`;
  button.type = 'button';
  button.setAttribute('aria-pressed', String(state.category === directory.path));
  button.style.setProperty('--depth', depth);
  const name = document.createElement('span');
  name.className = 'category-name';
  const icon = document.createElement('span');
  icon.className = 'category-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = depth === 0 ? (CATEGORY_ICONS[directory.name] || '📁') : '↳';
  const label = document.createElement('span');
  label.textContent = directory.name;
  name.append(icon, label);
  const count = document.createElement('span');
  count.className = 'category-count';
  count.textContent = directory.count;
  button.append(name, count);
  button.addEventListener('click', () => {
    state.category = directory.path;
    render();
  });
  row.append(button);

  const children = Array.from(directory.children.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (children.length) {
    if (!state.initializedDirectories.has(directory.path)) {
      state.expandedDirectories.add(directory.path);
      state.initializedDirectories.add(directory.path);
    }
    const expanded = state.expandedDirectories.has(directory.path);
    const toggle = document.createElement('button');
    toggle.className = 'category-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', `${expanded ? 'Réduire' : 'Développer'} ${directory.name}`);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.textContent = expanded ? '⌄' : '›';
    toggle.addEventListener('click', () => {
      if (state.expandedDirectories.has(directory.path)) {
        state.expandedDirectories.delete(directory.path);
      } else {
        state.expandedDirectories.add(directory.path);
      }
      render();
    });
    row.append(toggle);
  }

  entry.append(row);
  if (children.length && state.expandedDirectories.has(directory.path)) {
    const childList = document.createElement('div');
    childList.className = 'category-children';
    for (const child of children) childList.append(renderDirectory(child, depth + 1));
    entry.append(childList);
  }
  return entry;
}

function renderCategories() {
  const allButton = document.createElement('button');
  allButton.className = `category-button all-category${state.category === 'Toutes' ? ' active' : ''}`;
  allButton.type = 'button';
  allButton.setAttribute('aria-pressed', String(state.category === 'Toutes'));
  const allName = document.createElement('span');
  allName.className = 'category-name';
  const allIcon = document.createElement('span');
  allIcon.className = 'category-icon';
  allIcon.setAttribute('aria-hidden', 'true');
  allIcon.textContent = '⌂';
  const allLabel = document.createElement('span');
  allLabel.textContent = 'Toutes les recettes';
  allName.append(allIcon, allLabel);
  const allCount = document.createElement('span');
  allCount.className = 'category-count';
  allCount.textContent = state.recipes.length;
  allButton.append(allName, allCount);
  allButton.addEventListener('click', () => {
    state.category = 'Toutes';
    render();
  });

  const roots = Array.from(directoryTree().values())
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  categoriesElement.replaceChildren(allButton, ...roots.map((directory) => {
    return renderDirectory(directory, 0);
  }));
}

function renderList() {
  const recipes = visibleRecipes();
  const heading = state.category === 'Toutes'
    ? 'Toutes les recettes'
    : state.category.split('/').join(' / ');
  document.querySelector('#current-category').textContent = heading;
  document.querySelector('#recipe-count').textContent = `${recipes.length} recette${recipes.length > 1 ? 's' : ''}`;
  document.querySelector('#empty-list').hidden = recipes.length > 0;

  listElement.replaceChildren(...recipes.map((recipe) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `recipe-card${recipe.path === state.selectedPath ? ' active' : ''}`;
    const title = document.createElement('span');
    title.className = 'recipe-card-title';
    title.textContent = recipe.title;
    const meta = document.createElement('span');
    meta.className = 'recipe-card-meta';
    meta.textContent = [recipe.category, recipe.subcategory].filter(Boolean).join(' · ');
    button.append(title, meta);
    button.addEventListener('click', () => selectRecipe(recipe));
    return button;
  }));

  updateListColumnWidth(recipes);
}

function updateListColumnWidth(recipes) {
  const layout = document.querySelector('.content-layout');
  const titleElement = listElement.querySelector('.recipe-card-title');
  const metaElement = listElement.querySelector('.recipe-card-meta');
  const titleStyle = titleElement ? getComputedStyle(titleElement) : getComputedStyle(listElement);
  const metaStyle = metaElement ? getComputedStyle(metaElement) : titleStyle;

  const measure = (text, style) => {
    textMeasureContext.font = style.font;
    return textMeasureContext.measureText(text).width;
  };

  const contentWidth = Math.max(
    ...recipes.flatMap((recipe) => [
      measure(recipe.title, titleStyle),
      measure([recipe.category, recipe.subcategory].filter(Boolean).join(' · '), metaStyle),
    ]),
  );
  const layoutStyle = getComputedStyle(layout);
  const maxWidthValue = layoutStyle.getPropertyValue('--recipe-list-max-width').trim();
  const maxWidth = Number.parseFloat(maxWidthValue)
    * (maxWidthValue.endsWith('rem')
      ? Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
      : 1);
  const minWidth = Number.parseFloat(layoutStyle.getPropertyValue('--recipe-list-min-width'));
  const panelStyle = getComputedStyle(document.querySelector('.recipe-panel'));
  const cardStyle = titleElement ? getComputedStyle(titleElement.parentElement) : null;
  const horizontalPadding = Number.parseFloat(panelStyle.paddingLeft)
    + Number.parseFloat(panelStyle.paddingRight)
    + Number.parseFloat(panelStyle.borderLeftWidth)
    + (cardStyle ? Number.parseFloat(cardStyle.paddingLeft) + Number.parseFloat(cardStyle.paddingRight) : 26);
  const articleMinimum = 280;
  const availableWidth = Math.max(minWidth, layout.clientWidth - articleMinimum);
  const desiredWidth = (contentWidth + horizontalPadding) / 2;
  layout.style.setProperty(
    '--recipe-list-width',
    `${Math.min(availableWidth, maxWidth, Math.max(minWidth, desiredWidth))}px`,
  );
}

function render() {
  renderCategories();
  renderList();
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function inlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*|__(.+?)__/g, '<strong>$1$2</strong>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*|(^|[^_])_([^_\n]+)_/g,
    (match, a, b, c, d) => `${a || c || ''}<em>${b || d}</em>`);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return html;
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  let listType = '';
  let inCode = false;
  let codeLines = [];
  let tableLines = [];

  const closeList = () => {
    if (listType) output.push(`</${listType}>`);
    listType = '';
  };
  const flushTable = () => {
    if (!tableLines.length) return;
    const rows = tableLines.filter((line) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(line));
    const cells = rows.map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
    if (cells.length) {
      output.push('<table><thead><tr>');
      cells[0].forEach((cell) => output.push(`<th>${inlineMarkdown(cell)}</th>`));
      output.push('</tr></thead><tbody>');
      cells.slice(1).forEach((row) => {
        output.push('<tr>');
        cells[0].forEach((_, index) => output.push(`<td>${inlineMarkdown(row[index] || '')}</td>`));
        output.push('</tr>');
      });
      output.push('</tbody></table>');
    }
    tableLines = [];
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      closeList();
      flushTable();
      if (inCode) {
        output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (line.includes('|') && /^\s*\|?.+\|.+/.test(line)) {
      closeList();
      tableLines.push(line);
      continue;
    }
    flushTable();
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (!line.trim()) {
      closeList();
      continue;
    }
    if (heading) {
      closeList();
      const level = Math.min(Number(heading[1].length) + 1, 4);
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) {
      closeList();
      output.push('<hr>');
    } else if (/^\s*>\s?/.test(line)) {
      closeList();
      output.push(`<blockquote>${inlineMarkdown(line.replace(/^\s*>\s?/, ''))}</blockquote>`);
    } else if (unordered || ordered) {
      const type = unordered ? 'ul' : 'ol';
      if (listType !== type) {
        closeList();
        output.push(`<${type}>`);
        listType = type;
      }
      const item = (unordered || ordered)[1];
      output.push(`<li>${inlineMarkdown(item)}</li>`);
    } else {
      closeList();
      output.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }
  closeList();
  flushTable();
  if (inCode) output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  return output.join('\n');
}

function selectRecipe(recipe) {
  state.selectedPath = recipe.path;
  renderList();
  welcomeElement.hidden = true;
  contentElement.hidden = false;
  contentElement.innerHTML = markdownToHtml(recipe.content);
}

async function refreshRecipes() {
  let live = false;
  try {
    let response = await fetch(new URL('api/recipes', window.location.href), { cache: 'no-store' });
    if (response.ok) {
      live = true;
    } else {
      response = await fetch(new URL('recipes.json', window.location.href), { cache: 'no-store' });
    }
    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
    const data = await response.json();
    const previous = new Map(state.recipes.map((recipe) => [recipe.path, recipe.digest]));
    const next = new Map(data.recipes.map((recipe) => [recipe.path, recipe.digest]));
    const changed = previous.size !== next.size
      || Array.from(next).some(([path, signature]) => previous.get(path) !== signature);
    state.recipes = data.recipes;
    statusElement.textContent = live
      ? 'Synchronisé · actualisation automatique'
      : 'Publié sur GitHub Pages · actualisé après chaque push';
    statusDot.classList.remove('offline');
    if (changed) {
      const selected = state.recipes.find((recipe) => recipe.path === state.selectedPath);
      if (!selected) {
        state.selectedPath = '';
        contentElement.hidden = true;
        welcomeElement.hidden = false;
      } else if (previous.get(selected.path) !== next.get(selected.path)) {
        selectRecipe(selected);
      }
      render();
    } else if (!state.recipes.some((recipe) => recipe.path === state.selectedPath) && state.selectedPath) {
      state.selectedPath = '';
      contentElement.hidden = true;
      welcomeElement.hidden = false;
      render();
    }
  } catch (error) {
    statusElement.textContent = `Serveur indisponible · ${error.message}`;
    statusDot.classList.add('offline');
  }
  if (live || statusDot.classList.contains('offline')) window.setTimeout(refreshRecipes, live ? 2000 : 10000);
  else window.setTimeout(refreshRecipes, 60000);
}

searchElement.addEventListener('input', renderList);
window.addEventListener('resize', () => renderList());
searchElement.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    searchElement.value = '';
    renderList();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && document.activeElement !== searchElement) {
    event.preventDefault();
    searchElement.focus();
  }
});
refreshRecipes();

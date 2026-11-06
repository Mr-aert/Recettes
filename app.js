const CATEGORY_ICONS = {
  LAITS: '🥛',
  MALADIE: '🌿',
  PATES: '🥧',
  SALEES: '🍲',
  SOUPES: '🍵',
  SUCREES: '🍰',
  Autres: '🍽️',
};

const CATEGORY_LABELS = {
  LAITS: 'Boissons végétales',
  MALADIE: 'Bien-être',
  PATES: 'Pâtes & bases',
  SALEES: 'Plats salés',
  SOUPES: 'Soupes',
  SUCREES: 'Desserts',
};

const savedFavorites = readStoredJSON('recipe-favorites', []);
const savedShoppingList = readStoredJSON('recipe-shopping-list', []);

function readStoredJSON(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.warn(`Impossible de lire ${key}.`, error);
    return fallback;
  }
}

function writeStoredJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Impossible d’enregistrer ${key}.`, error);
  }
}

const state = {
  recipes: [],
  menuOfTheDay: [],
  category: 'Toutes',
  filter: 'all',
  selectedPath: '',
  expandedDirectories: new Set(),
  initializedDirectories: new Set(),
  favorites: new Set(Array.isArray(savedFavorites) ? savedFavorites : []),
  shoppingList: Array.isArray(savedShoppingList) ? savedShoppingList : [],
  cookStepIndex: 0,
};

const categoriesElement = document.querySelector('#categories');
const menuOfTheDayElement = document.querySelector('#menu-of-the-day');
const menuOfTheDayListElement = document.querySelector('#menu-of-the-day-list');
const listElement = document.querySelector('#recipe-list');
const searchElement = document.querySelector('#search');
const contentElement = document.querySelector('#recipe-content');
const welcomeElement = document.querySelector('#welcome');
const statusElement = document.querySelector('#sync-status');
const statusDot = document.querySelector('.live-dot');
const themeToggle = document.querySelector('#theme-toggle');
const shoppingDialog = document.querySelector('#shopping-dialog');

function normalizeText(text) {
  return text.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function displayCategory(name) {
  return CATEGORY_LABELS[name] || name;
}

function capitalizeFirstLetter(text) {
  const [firstLetter, ...rest] = text;
  return firstLetter ? `${firstLetter.toLocaleUpperCase('fr')}${rest.join('')}` : text;
}

function recipeDetails(recipe) {
  const frontmatter = recipe.content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  const metadata = {};
  if (frontmatter) {
    for (const line of frontmatter[1].split('\n')) {
      const field = line.match(/^\s*([a-z_-]+)\s*:\s*(.*?)\s*$/i);
      if (!field) continue;
      const [, key, rawValue] = field;
      const value = rawValue.replace(/^['"]|['"]$/g, '');
      metadata[key.toLocaleLowerCase('fr')] = value.startsWith('[')
        ? value.slice(1, -1).split(',').map((tag) => tag.trim().replace(/^['"]|['"]$/g, '').toLocaleLowerCase('fr'))
        : value;
    }
  }
  const body = frontmatter ? recipe.content.slice(frontmatter[0].length) : recipe.content;
  const metadataTitle = typeof metadata.title === 'string' ? metadata.title.trim() : '';
  const genericTitle = /^(ingr[eé]dients?|pr[eé]paration|instructions?|m[eé]thode\s+optimis[eé]e)$/i;
  const fileTitle = recipe.path.split('/').pop()
    .replace(/\.md$/i, '')
    .replace(/_(d|l|qu)_/gi, ' $1’')
    .replace(/_/g, ' ')
    .trim();
  const title = capitalizeFirstLetter(metadataTitle && !genericTitle.test(metadataTitle) ? metadataTitle : fileTitle);
  const timeValue = (value) => {
    const match = String(value || '').match(/\d+/);
    return match ? Number(match[0]) : 0;
  };
  let preparation = timeValue(metadata.preparation || metadata.prep);
  let cooking = timeValue(metadata.cuisson || metadata.cooking);
  let totalMinutes = timeValue(metadata.temps_total || metadata.total || metadata.temps);
  if (!preparation && !cooking && !totalMinutes) {
    for (const line of body.split('\n')) {
      if (!/(?:préparation|prep)\s*:/i.test(line)) continue;
      const prepMatch = line.match(/(?:préparation|prep)\s*:\s*(\d+)\s*min/i);
      const cookMatch = line.match(/cuisson\s*:\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*min/i);
      preparation = prepMatch ? Number(prepMatch[1]) : 0;
      cooking = cookMatch ? Number(cookMatch[2] || cookMatch[1]) : 0;
      if (preparation || cooking) break;
    }
  }
  totalMinutes ||= preparation && cooking ? preparation + cooking : preparation || cooking;
  const servingValue = metadata.portions || metadata.servings;
  const servingMatch = String(servingValue || body).match(/(?:pour\s+)?(\d+)\s*(?:personnes|portions)/i);
  const portions = servingValue ? timeValue(servingValue) : servingMatch ? Number(servingMatch[1]) : 0;
  const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
  const image = metadata.image || '';
  return {
    ...recipe,
    title,
    body,
    tags,
    totalMinutes,
    portions,
    image,
    imageAlt: metadata.image_alt || title,
  };
}

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
  const query = normalizeText(searchElement.value.trim());
  return state.recipes.filter((recipe) => {
    const matchesCategory = state.category === 'Toutes'
      || (state.category === 'Autres'
        ? recipe.category === 'Autres'
        : recipe.path.startsWith(`${state.category}/`));
    const matchesQuery = !query || normalizeText(`${recipe.title} ${recipe.path} ${recipe.body}`).includes(query);
    const matchesFilter = state.filter === 'all'
      || (state.filter === 'favorites' && state.favorites.has(recipe.path));
    return matchesCategory && matchesQuery && matchesFilter;
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
  label.textContent = displayCategory(directory.name);
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

function buildMenuOfTheDay() {
  const savoryRecipes = state.recipes.filter((recipe) => {
    const rootCategory = String(recipe.path.split('/')[0] || '').toUpperCase();
    return rootCategory === 'SALEES' || rootCategory === 'SOUPES';
  });
  const dessertRecipes = state.recipes.filter((recipe) => {
    const rootCategory = String(recipe.path.split('/')[0] || '').toUpperCase();
    return rootCategory === 'SUCREES';
  });

  const savoryRecipe = savoryRecipes.length
    ? savoryRecipes[Math.floor(Math.random() * savoryRecipes.length)]
    : null;
  const dessertRecipe = dessertRecipes.length
    ? dessertRecipes[Math.floor(Math.random() * dessertRecipes.length)]
    : null;

  return [savoryRecipe, dessertRecipe].filter(Boolean);
}

function renderMenuOfTheDay() {
  if (!menuOfTheDayElement || !menuOfTheDayListElement) return;
  if (!state.menuOfTheDay.length) {
    menuOfTheDayElement.hidden = true;
    menuOfTheDayListElement.replaceChildren();
    return;
  }

  menuOfTheDayElement.hidden = false;
  menuOfTheDayListElement.replaceChildren(...state.menuOfTheDay.map((recipe) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu-recipe';
    button.setAttribute('aria-label', `Voir la recette ${recipe.title}`);
    button.addEventListener('click', () => selectRecipe(recipe));

    const title = document.createElement('span');
    title.className = 'menu-recipe-title';
    title.textContent = recipe.title;

    const category = document.createElement('span');
    category.className = 'menu-recipe-category';
    category.textContent = displayCategory(recipe.path.split('/')[0] || 'Autres');

    button.append(title, category);
    return button;
  }));
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
    : state.category.split('/').map(displayCategory).join(' / ');
  document.querySelector('#current-category').textContent = heading;
  document.querySelector('#recipe-count').textContent = `${recipes.length} recette${recipes.length > 1 ? 's' : ''}`;
  document.querySelector('#empty-list').hidden = recipes.length > 0;
  document.querySelector('#empty-list').textContent = state.filter === 'favorites' && !state.favorites.size
    ? 'Ajoutez une recette à vos favoris pour la retrouver ici.'
    : 'Aucune recette trouvée.';
  document.querySelectorAll('.filter-chip').forEach((button) => {
    const active = button.dataset.filter === state.filter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  listElement.replaceChildren(...recipes.map((recipe) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `recipe-card${recipe.path === state.selectedPath ? ' active' : ''}`;
    const title = document.createElement('span');
    title.className = 'recipe-card-title';
    title.textContent = recipe.title;
    if (state.favorites.has(recipe.path)) {
      const favorite = document.createElement('span');
      favorite.className = 'favorite-mark';
      favorite.setAttribute('aria-label', 'Favori');
      favorite.textContent = '♥';
      title.append(favorite);
    }
    const meta = document.createElement('span');
    meta.className = 'recipe-card-meta';
    const category = [displayCategory(recipe.category), recipe.subcategory].filter(Boolean).join(' · ');
    const time = recipe.totalMinutes ? `${recipe.totalMinutes} min` : '';
    meta.textContent = [category, time].filter(Boolean).join(' · ');
    button.append(title, meta);
    button.addEventListener('click', () => selectRecipe(recipe));
    return button;
  }));

}

function render() {
  renderMenuOfTheDay();
  renderCategories();
  renderList();
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function inlineMarkdown(text) {
  text = text.replace(/\\(?=[\\`*_{}\[\]()#+\-.!>])/g, '');
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
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
    .map((line) => line.replace(/\\\s*$/, ''));
  const output = [];
  let listType = '';
  let listItemOpen = false;
  let inCode = false;
  let codeLines = [];
  let tableLines = [];

  const closeList = () => {
    if (listItemOpen) output.push('</li>');
    if (listType) output.push(`</${listType}>`);
    listType = '';
    listItemOpen = false;
  };
  const closeListItem = () => {
    if (listItemOpen) output.push('</li>');
    listItemOpen = false;
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
    if (/^\s*<!--.*-->\s*$/.test(line)) continue;
    if (line.includes('|') && /^\s*\|?.+\|.+/.test(line)) {
      closeList();
      tableLines.push(line);
      continue;
    }
    flushTable();
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
    const ordered = line.match(/^\s*(\d+)\\?[.)]\s+(.+)$/);
    if (!line.trim()) {
      continue;
    }
    if (heading) {
      closeList();
      const level = Math.min(Number(heading[1].length) + 1, 4);
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) {
      closeList();
      output.push('<hr>');
    } else if (/^\s*\\?>\s?/.test(line)) {
      closeList();
      output.push(`<blockquote>${inlineMarkdown(line.replace(/^\s*\\?>\s?/, ''))}</blockquote>`);
    } else if (unordered || ordered) {
      const type = unordered ? 'ul' : 'ol';
      if (listType !== type) {
        closeList();
        output.push(`<${type}>`);
        listType = type;
      } else {
        closeListItem();
      }
      const item = unordered ? unordered[1] : ordered[2];
      const value = ordered ? ` value="${ordered[1]}"` : '';
      output.push(`<li${value}>${inlineMarkdown(item)}`);
      listItemOpen = true;
    } else {
      if (listItemOpen) {
        output.push(`<p>${inlineMarkdown(line.trim())}</p>`);
        continue;
      }
      closeList();
      output.push(`<p>${inlineMarkdown(line.trim())}</p>`);
    }
  }
  closeList();
  flushTable();
  if (inCode) output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  return output.join('\n');
}

function saveShoppingList() {
  writeStoredJSON('recipe-shopping-list', state.shoppingList);
  document.querySelector('#shopping-count').textContent = state.shoppingList.filter((item) => !item.checked).length;
}

function renderShoppingList() {
  const container = document.querySelector('#shopping-items');
  container.replaceChildren();
  if (!state.shoppingList.length) {
    const empty = document.createElement('p');
    empty.className = 'shopping-empty';
    empty.textContent = 'Votre liste est vide. Ajoutez-y les ingrédients d’une recette.';
    container.append(empty);
  }
  for (const item of state.shoppingList) {
    const row = document.createElement('div');
    row.className = 'shopping-item';
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(item.checked);
    checkbox.addEventListener('change', () => {
      item.checked = checkbox.checked;
      saveShoppingList();
      renderShoppingList();
    });
    const text = document.createElement('span');
    text.textContent = item.text;
    const recipe = document.createElement('small');
    recipe.textContent = item.recipe;
    label.append(checkbox, text, recipe);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icon-button shopping-remove';
    remove.setAttribute('aria-label', `Retirer ${item.text}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      state.shoppingList = state.shoppingList.filter((entry) => entry.id !== item.id);
      saveShoppingList();
      renderShoppingList();
    });
    row.append(label, remove);
    container.append(row);
  }
}

function addIngredientsToShopping(recipe, ingredients) {
  for (const [index, ingredient] of ingredients.entries()) {
    const id = `${recipe.path}:${index}`;
    if (state.shoppingList.some((item) => item.id === id)) continue;
    state.shoppingList.push({ id, text: ingredient.textContent.trim(), recipe: recipe.title });
  }
  saveShoppingList();
  renderShoppingList();
  shoppingDialog.showModal();
}

function updateRecipeURL(recipePath, replace = false) {
  const url = new URL(window.location.href);
  if (recipePath) url.searchParams.set('recipe', recipePath);
  else url.searchParams.delete('recipe');
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
}

function ingredientItems(container) {
  const items = [];
  const headings = Array.from(container.querySelectorAll('h2, h3, h4'));
  for (const heading of headings) {
    if (!/ingr[eé]dient/i.test(heading.textContent)) continue;
    for (let sibling = heading.nextElementSibling; sibling && !/^H[2-4]$/.test(sibling.tagName); sibling = sibling.nextElementSibling) {
      if (sibling.matches('ul, ol')) items.push(...sibling.querySelectorAll('li'));
    }
  }
  return items;
}

function preparationItems(container) {
  const items = [];
  const headings = Array.from(container.querySelectorAll('h2, h3, h4'));
  for (const heading of headings) {
    if (!/pr[eé]paration|instructions?/i.test(heading.textContent)) continue;
    for (let sibling = heading.nextElementSibling; sibling && !/^H[2-4]$/.test(sibling.tagName); sibling = sibling.nextElementSibling) {
      if (sibling.matches('ol')) items.push(...sibling.querySelectorAll('li'));
    }
  }
  return items;
}

function ingredientCheckboxes(recipe, ingredients) {
  const checkedItems = new Set(readStoredJSON(`recipe-checked:${recipe.path}`, []));
  for (const [index, item] of ingredients.entries()) {
    item.dataset.originalText = item.textContent.trim();
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'ingredient-check';
    checkbox.checked = checkedItems.has(index);
    checkbox.setAttribute('aria-label', `Cocher : ${item.dataset.originalText}`);
    item.classList.toggle('checked', checkbox.checked);
    checkbox.addEventListener('change', () => {
      item.classList.toggle('checked', checkbox.checked);
      const current = new Set(readStoredJSON(`recipe-checked:${recipe.path}`, []));
      if (checkbox.checked) current.add(index);
      else current.delete(index);
      writeStoredJSON(`recipe-checked:${recipe.path}`, [...current]);
    });
    item.prepend(checkbox);
  }
}

function applyPortionScaling(ingredients, basePortions, portions) {
  for (const item of ingredients) {
    const original = item.dataset.originalText;
    const amount = original.match(/^(\s*)(\d+(?:[.,]\d+)?|½|¼|¾|⅓|⅔)(?=\s|$)(.*)$/);
    if (!amount) continue;
    const fractions = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
    const number = fractions[amount[2]] ?? Number(amount[2].replace(',', '.'));
    const scaled = Math.round(number * portions / basePortions * 100) / 100;
    const display = Number.isInteger(scaled)
      ? String(scaled)
      : String(scaled).replace('.', ',');
    const checkbox = item.querySelector('.ingredient-check');
    item.replaceChildren(...(checkbox ? [checkbox] : []), document.createTextNode(`${amount[1]}${display}${amount[3]}`));
  }
}

function setCookingStep(steps, index) {
  if (!steps.length) return;
  state.cookStepIndex = Math.max(0, Math.min(index, steps.length - 1));
  steps.forEach((step, stepIndex) => {
    step.classList.toggle('current-step', stepIndex === state.cookStepIndex);
    step.classList.toggle('completed-step', stepIndex < state.cookStepIndex);
  });
  const progress = document.querySelector('#cook-progress');
  if (progress) progress.textContent = `Étape ${state.cookStepIndex + 1} sur ${steps.length}`;
  const previous = document.querySelector('#cook-previous');
  const next = document.querySelector('#cook-next');
  if (previous) previous.disabled = state.cookStepIndex === 0;
  if (next) next.disabled = state.cookStepIndex === steps.length - 1;
}

function selectRecipe(recipe, updateHistory = true) {
  state.selectedPath = recipe.path;
  renderList();
  welcomeElement.hidden = true;
  contentElement.hidden = false;
  contentElement.replaceChildren();
  document.title = `${recipe.title} · Mes recettes`;
  if (updateHistory) updateRecipeURL(recipe.path);

  const title = document.createElement('h1');
  title.className = 'recipe-title';
  title.textContent = recipe.title;
  contentElement.append(title);
  if (recipe.image) {
    const image = document.createElement('img');
    image.className = 'recipe-image';
    image.alt = recipe.imageAlt;
    image.loading = 'lazy';
    image.src = /^https?:\/\//i.test(recipe.image)
      ? recipe.image
      : new URL(recipe.image, new URL(recipe.path, window.location.href)).href;
    contentElement.append(image);
  }

  const metadata = document.createElement('div');
  metadata.className = 'recipe-metadata';
  const metadataParts = [];
  if (recipe.totalMinutes) metadataParts.push(`⏱ ${recipe.totalMinutes} min`);
  if (recipe.portions) metadataParts.push(`🍽 ${recipe.portions} portions`);
  if (recipe.tags.length) metadataParts.push(...recipe.tags.map((tag) => `#${tag}`));
  metadata.textContent = metadataParts.join('  ·  ');
  metadata.hidden = !metadataParts.length;
  contentElement.append(metadata);

  const actions = document.createElement('div');
  actions.className = 'recipe-actions';
  const favoriteButton = document.createElement('button');
  favoriteButton.type = 'button';
  favoriteButton.className = 'action-button favorite-button';
  const updateFavoriteLabel = () => {
    const favorite = state.favorites.has(recipe.path);
    favoriteButton.textContent = favorite ? '♥ En favoris' : '♡ Ajouter aux favoris';
    favoriteButton.setAttribute('aria-pressed', String(favorite));
  };
  updateFavoriteLabel();
  favoriteButton.addEventListener('click', () => {
    if (state.favorites.has(recipe.path)) state.favorites.delete(recipe.path);
    else state.favorites.add(recipe.path);
    writeStoredJSON('recipe-favorites', [...state.favorites]);
    updateFavoriteLabel();
    renderList();
  });
  const shoppingButton = document.createElement('button');
  shoppingButton.type = 'button';
  shoppingButton.className = 'action-button';
  shoppingButton.textContent = '＋ Ajouter aux courses';
  shoppingButton.addEventListener('click', () => addIngredientsToShopping(recipe, ingredients));
  const shareButton = document.createElement('button');
  shareButton.type = 'button';
  shareButton.className = 'action-button';
  shareButton.textContent = '↗ Partager';
  shareButton.addEventListener('click', async () => {
    updateRecipeURL(recipe.path, true);
    try {
      await navigator.clipboard.writeText(window.location.href);
      shareButton.textContent = 'Lien copié !';
      window.setTimeout(() => { shareButton.textContent = '↗ Partager'; }, 1800);
    } catch (error) {
      console.warn('Impossible de copier le lien de la recette.', error);
      shareButton.textContent = 'Copie indisponible';
    }
  });
  actions.append(favoriteButton, shoppingButton, shareButton);

  const ingredients = [];
  const body = document.createElement('div');
  body.className = 'recipe-body';
  body.innerHTML = markdownToHtml(recipe.body);
  const firstHeading = body.querySelector('h2, h3');
  if (firstHeading && normalizeText(firstHeading.textContent) === normalizeText(recipe.title)) firstHeading.remove();
  ingredients.push(...ingredientItems(body));
  ingredientCheckboxes(recipe, ingredients);
  contentElement.append(actions, body);

  const steps = preparationItems(body);
  if (recipe.portions && ingredients.length) {
    const portionControl = document.createElement('div');
    portionControl.className = 'portion-control';
    const label = document.createElement('span');
    label.textContent = 'Portions';
    const decrease = document.createElement('button');
    decrease.type = 'button';
    decrease.setAttribute('aria-label', 'Diminuer les portions');
    decrease.textContent = '−';
    const count = document.createElement('output');
    count.textContent = recipe.portions;
    const increase = document.createElement('button');
    increase.type = 'button';
    increase.setAttribute('aria-label', 'Augmenter les portions');
    increase.textContent = '+';
    let portions = recipe.portions;
    decrease.addEventListener('click', () => {
      portions = Math.max(1, portions - 1);
      count.textContent = portions;
      applyPortionScaling(ingredients, recipe.portions, portions);
    });
    increase.addEventListener('click', () => {
      portions += 1;
      count.textContent = portions;
      applyPortionScaling(ingredients, recipe.portions, portions);
    });
    portionControl.append(label, decrease, count, increase);
    actions.append(portionControl);
  }
  if (steps.length) {
    const cookButton = document.createElement('button');
    cookButton.type = 'button';
    cookButton.className = 'action-button cook-button';
    cookButton.textContent = '▶ Mode cuisine';
    const cookControls = document.createElement('div');
    cookControls.className = 'cook-controls';
    const closeCook = document.createElement('button');
    closeCook.type = 'button';
    closeCook.className = 'action-button';
    closeCook.textContent = 'Quitter le mode cuisine';
    closeCook.addEventListener('click', () => document.querySelector('.recipe-view').classList.remove('cooking-mode'));
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.id = 'cook-previous';
    previous.className = 'action-button';
    previous.textContent = '← Précédente';
    previous.addEventListener('click', () => setCookingStep(steps, state.cookStepIndex - 1));
    const progress = document.createElement('span');
    progress.id = 'cook-progress';
    progress.setAttribute('aria-live', 'polite');
    const next = document.createElement('button');
    next.type = 'button';
    next.id = 'cook-next';
    next.className = 'action-button';
    next.textContent = 'Suivante →';
    next.addEventListener('click', () => setCookingStep(steps, state.cookStepIndex + 1));
    cookControls.append(closeCook, previous, progress, next);
    cookButton.addEventListener('click', () => {
      state.cookStepIndex = 0;
      setCookingStep(steps, 0);
      document.querySelector('.recipe-view').classList.add('cooking-mode');
      steps[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    actions.append(cookButton);
    contentElement.append(cookControls);
  }
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
    state.recipes = data.recipes.map(recipeDetails);
    state.menuOfTheDay = buildMenuOfTheDay();
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
        document.title = 'Mes recettes';
      } else if (previous.get(selected.path) !== next.get(selected.path)) {
        selectRecipe(selected, false);
      }
      render();
    }
    const sharedPath = new URLSearchParams(window.location.search).get('recipe');
    const sharedRecipe = state.recipes.find((recipe) => recipe.path === sharedPath);
    if (sharedRecipe && sharedRecipe.path !== state.selectedPath) {
      selectRecipe(sharedRecipe, false);
    } else if (!state.recipes.some((recipe) => recipe.path === state.selectedPath) && state.selectedPath) {
      state.selectedPath = '';
      contentElement.hidden = true;
      welcomeElement.hidden = false;
      document.title = 'Mes recettes';
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
document.querySelectorAll('.filter-chip').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.disabled) return;
    state.filter = button.dataset.filter;
    renderList();
  });
});
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
document.querySelector('#shopping-open').addEventListener('click', () => {
  renderShoppingList();
  shoppingDialog.showModal();
});
document.querySelector('#shopping-close').addEventListener('click', () => shoppingDialog.close());
document.querySelector('#shopping-clear').addEventListener('click', () => {
  state.shoppingList = [];
  saveShoppingList();
  renderShoppingList();
});
window.addEventListener('popstate', () => {
  const path = new URLSearchParams(window.location.search).get('recipe');
  const recipe = state.recipes.find((entry) => entry.path === path);
  if (recipe) selectRecipe(recipe, false);
});
renderShoppingList();
saveShoppingList();
refreshRecipes();

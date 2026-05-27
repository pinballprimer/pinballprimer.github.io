/* Index page: fetches gamelist, drives search and filters. */
(function () {
	'use strict';

	const GAMELIST_URL = '../gamelist.html';
	const CACHE_KEY = 'gamelist_cache_v1';
	const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
	const NAVIGATION_LIST_KEY = 'currentFilteredIds';

	const elements = {
		search: document.getElementById('searchInput'),
		decade: document.getElementById('decadeFilter'),
		manufacturer: document.getElementById('manufacturerFilter'),
		type: document.getElementById('typeFilter'),
		gameList: document.getElementById('gameList'),
		resultCount: document.getElementById('resultCount'),
		clearFilters: document.getElementById('clearFilters'),
	};

	let allGames = [];

	async function loadGames() {
		const cached = readCache();
		if (cached) {
			return cached;
		}
		const response = await fetch(GAMELIST_URL);
		if (!response.ok) {
			throw new Error(`Failed to load gamelist (${response.status})`);
		}
		const htmlText = await response.text();
		const games = window.Parser.parseGameList(htmlText);
		writeCache(games);
		return games;
	}

	function readCache() {
		try {
			const raw = sessionStorage.getItem(CACHE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
			return parsed.games;
		} catch (err) {
			return null;
		}
	}

	function writeCache(games) {
		try {
			sessionStorage.setItem(CACHE_KEY, JSON.stringify({
				savedAt: Date.now(),
				games,
			}));
		} catch (err) {
			/* sessionStorage may be unavailable or full; ignore */
		}
	}

	function uniqueSortedValues(games, key) {
		const set = new Set();
		for (const game of games) {
			if (game[key]) set.add(game[key]);
		}
		return Array.from(set).sort();
	}

	function uniqueSortedDecades(games) {
		const set = new Set();
		for (const game of games) {
			if (game.decade) set.add(game.decade);
		}
		return Array.from(set).sort();
	}

	function populateSelect(selectEl, values) {
		for (const value of values) {
			const option = document.createElement('option');
			option.value = value;
			option.textContent = value;
			selectEl.appendChild(option);
		}
	}

	function readFiltersFromUrl() {
		const params = new URLSearchParams(window.location.search);
		return {
			query: (params.get('q') || '').trim(),
			decade: params.get('decade') || '',
			manufacturer: params.get('manufacturer') || '',
			type: params.get('type') || '',
		};
	}

	function writeFiltersToUrl(filters) {
		const params = new URLSearchParams();
		if (filters.query) params.set('q', filters.query);
		if (filters.decade) params.set('decade', filters.decade);
		if (filters.manufacturer) params.set('manufacturer', filters.manufacturer);
		if (filters.type) params.set('type', filters.type);
		const newQs = params.toString();
		const newUrl = newQs
			? `${window.location.pathname}?${newQs}`
			: window.location.pathname;
		window.history.replaceState(null, '', newUrl);
	}

	function applyFiltersToInputs(filters) {
		elements.search.value = filters.query;
		elements.decade.value = filters.decade;
		elements.manufacturer.value = filters.manufacturer;
		elements.type.value = filters.type;
	}

	function readFiltersFromInputs() {
		return {
			query: elements.search.value.trim(),
			decade: elements.decade.value,
			manufacturer: elements.manufacturer.value,
			type: elements.type.value,
		};
	}

	function filterGames(games, filters) {
		const queryLower = filters.query.toLowerCase();
		return games.filter(game => {
			if (filters.decade && game.decade !== filters.decade) return false;
			if (filters.manufacturer && game.manufacturer !== filters.manufacturer) return false;
			if (filters.type && game.type !== filters.type) return false;
			if (queryLower && !game.title.toLowerCase().includes(queryLower)) return false;
			return true;
		});
	}

	function renderGames(games, filters) {
		elements.gameList.innerHTML = '';
		if (games.length === 0) {
			const empty = document.createElement('p');
			empty.className = 'empty-state';
			empty.textContent = 'No games match your filters.';
			elements.gameList.appendChild(empty);
		} else {
			const fragment = document.createDocumentFragment();
			for (const game of games) {
				fragment.appendChild(buildGameCard(game, filters));
			}
			elements.gameList.appendChild(fragment);
		}

		const total = allGames.length;
		const shown = games.length;
		elements.resultCount.textContent = shown === total
			? `${shown} games`
			: `${shown} of ${total} games`;

		const hasFilters = Boolean(
			filters.query || filters.decade || filters.manufacturer || filters.type
		);
		elements.clearFilters.hidden = !hasFilters;

		saveFilteredIdsForNavigation(games);
	}

	function buildGameCard(game, filters) {
		const card = document.createElement('a');
		card.className = 'game-card';
		card.href = buildGameLink(game, filters);

		const title = document.createElement('div');
		title.className = 'game-card-title';
		title.textContent = game.title;

		const meta = document.createElement('div');
		meta.className = 'game-card-meta';
		meta.textContent = buildMetaLine(game);

		card.appendChild(title);
		card.appendChild(meta);
		return card;
	}

	function buildMetaLine(game) {
		const pieces = [];
		if (game.manufacturer) pieces.push(game.manufacturer);
		if (game.type) pieces.push(game.type);
		if (game.year) pieces.push(String(game.year));
		return pieces.join(' · ');
	}

	function buildGameLink(game, filters) {
		const params = new URLSearchParams();
		params.set('id', game.id);
		const fromQs = filtersToQueryString(filters);
		if (fromQs) params.set('from', fromQs);
		return `game.html?${params.toString()}`;
	}

	function filtersToQueryString(filters) {
		const params = new URLSearchParams();
		if (filters.query) params.set('q', filters.query);
		if (filters.decade) params.set('decade', filters.decade);
		if (filters.manufacturer) params.set('manufacturer', filters.manufacturer);
		if (filters.type) params.set('type', filters.type);
		return params.toString();
	}

	function saveFilteredIdsForNavigation(games) {
		try {
			const ids = games.map(g => g.id);
			sessionStorage.setItem(NAVIGATION_LIST_KEY, JSON.stringify(ids));
		} catch (err) {
			/* ignore */
		}
	}

	function debounce(fn, ms) {
		let timer = null;
		return function debounced(...args) {
			clearTimeout(timer);
			timer = setTimeout(() => fn.apply(this, args), ms);
		};
	}

	function refresh() {
		const filters = readFiltersFromInputs();
		writeFiltersToUrl(filters);
		const filtered = filterGames(allGames, filters);
		renderGames(filtered, filters);
	}

	function clearFilters() {
		elements.search.value = '';
		elements.decade.value = '';
		elements.manufacturer.value = '';
		elements.type.value = '';
		refresh();
		elements.search.focus();
	}

	function showLoadError(error) {
		elements.gameList.innerHTML = '';
		const errBox = document.createElement('div');
		errBox.className = 'error';
		errBox.textContent = `Could not load game list: ${error.message}`;
		elements.gameList.appendChild(errBox);
		elements.resultCount.textContent = '';
	}

	async function init() {
		try {
			allGames = await loadGames();
		} catch (err) {
			showLoadError(err);
			return;
		}

		populateSelect(elements.decade, uniqueSortedDecades(allGames));
		populateSelect(elements.manufacturer, uniqueSortedValues(allGames, 'manufacturer'));
		populateSelect(elements.type, uniqueSortedValues(allGames, 'type'));

		const initialFilters = readFiltersFromUrl();
		applyFiltersToInputs(initialFilters);

		const filtered = filterGames(allGames, initialFilters);
		renderGames(filtered, initialFilters);

		elements.search.addEventListener('input', debounce(refresh, 120));
		elements.decade.addEventListener('change', refresh);
		elements.manufacturer.addEventListener('change', refresh);
		elements.type.addEventListener('change', refresh);
		elements.clearFilters.addEventListener('click', clearFilters);
	}

	init();
})();

/* Game reader page: fetches a single game's HTML and renders it cleanly. */
(function () {
	'use strict';

	const NAVIGATION_LIST_KEY = 'currentFilteredIds';
	const GAMELIST_URL = '../gamelist.html';

	const elements = {
		content: document.getElementById('gameContent'),
		back: document.getElementById('backLink'),
		source: document.getElementById('sourceLink'),
		prev: document.getElementById('prevLink'),
		next: document.getElementById('nextLink'),
	};

	function readPageParams() {
		const params = new URLSearchParams(window.location.search);
		return {
			id: params.get('id') || '',
			from: params.get('from') || '',
		};
	}

	function configureBackLink(fromQueryString) {
		elements.back.href = fromQueryString
			? `index.html?${fromQueryString}`
			: 'index.html';
	}

	function configureSourceLink(id) {
		elements.source.href = `https://pinballprimer.github.io/${id}.html`;
	}

	function getNavigationIds(currentId) {
		try {
			const raw = sessionStorage.getItem(NAVIGATION_LIST_KEY);
			if (!raw) return null;
			const ids = JSON.parse(raw);
			if (!Array.isArray(ids) || ids.length === 0) return null;
			if (!ids.includes(currentId)) return null;
			return ids;
		} catch (err) {
			return null;
		}
	}

	async function fetchAlphabeticalIds() {
		try {
			const response = await fetch(GAMELIST_URL);
			if (!response.ok) return null;
			const html = await response.text();
			const games = window.Parser.parseGameList(html);
			return games.map(g => g.id);
		} catch (err) {
			return null;
		}
	}

	function buildPrevNextHref(targetId, fromQueryString) {
		const params = new URLSearchParams();
		params.set('id', targetId);
		if (fromQueryString) params.set('from', fromQueryString);
		return `game.html?${params.toString()}`;
	}

	function configurePrevNext(ids, currentId, fromQueryString) {
		const index = ids.indexOf(currentId);
		if (index === -1) return;

		if (index > 0) {
			elements.prev.href = buildPrevNextHref(ids[index - 1], fromQueryString);
			elements.prev.hidden = false;
		}
		if (index < ids.length - 1) {
			elements.next.href = buildPrevNextHref(ids[index + 1], fromQueryString);
			elements.next.hidden = false;
		}
	}

	async function loadGameHtml(id) {
		const response = await fetch(`../${id}.html`);
		if (!response.ok) {
			throw new Error(`Could not load game (${response.status})`);
		}
		return response.text();
	}

	function renderGame(parsed) {
		elements.content.innerHTML = '';

		const titleEl = document.createElement('h1');
		titleEl.textContent = parsed.title;
		elements.content.appendChild(titleEl);

		const metaPieces = [];
		if (parsed.manufacturer) metaPieces.push(parsed.manufacturer);
		if (parsed.type) metaPieces.push(parsed.type);
		if (parsed.year) metaPieces.push(String(parsed.year));
		if (metaPieces.length > 0) {
			const metaEl = document.createElement('p');
			metaEl.className = 'game-meta';
			metaEl.textContent = metaPieces.join(' · ');
			elements.content.appendChild(metaEl);
		}

		for (const section of parsed.sections) {
			if (section.heading) {
				const headingEl = document.createElement(`h${section.level}`);
				headingEl.textContent = section.heading;
				elements.content.appendChild(headingEl);
			}
			if (section.contentHtml) {
				const wrapper = document.createElement('div');
				wrapper.innerHTML = section.contentHtml;
				rewriteImageSources(wrapper);
				while (wrapper.firstChild) {
					elements.content.appendChild(wrapper.firstChild);
				}
			}
		}

		document.title = `${parsed.title} — Pinball Primer (mobile)`;
	}

	function rewriteImageSources(container) {
		for (const img of container.querySelectorAll('img')) {
			const src = img.getAttribute('src') || '';
			if (!src) continue;
			if (src.startsWith('http') || src.startsWith('/') || src.startsWith('..')) continue;
			img.setAttribute('src', `../${src}`);
			img.removeAttribute('width');
			img.removeAttribute('height');
			img.removeAttribute('class');
			img.setAttribute('loading', 'lazy');
		}
	}

	function showError(message) {
		elements.content.innerHTML = '';
		const errBox = document.createElement('div');
		errBox.className = 'error';
		errBox.textContent = message;
		elements.content.appendChild(errBox);
	}

	async function init() {
		const { id, from } = readPageParams();
		configureBackLink(from);

		if (!id) {
			showError('No game specified. Go back to the list.');
			return;
		}

		configureSourceLink(id);

		try {
			const html = await loadGameHtml(id);
			const parsed = window.Parser.parseGamePage(html);
			renderGame(parsed);
		} catch (err) {
			showError(`Could not load this game: ${err.message}`);
			return;
		}

		let ids = getNavigationIds(id);
		if (!ids) {
			ids = await fetchAlphabeticalIds();
		}
		if (ids) {
			configurePrevNext(ids, id, from);
		}
	}

	init();
})();

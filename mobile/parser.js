/* Parses upstream Pinball Primer HTML into structured data.
   Exposed as window.Parser. */
(function () {
	'use strict';

	const TITLE_METADATA_PATTERN = /^(.+?)\s*\(([^)]+)\)\s*$/;
	const KNOWN_TYPES = new Set(['EM', 'SS', 'AN', 'DMD', 'LCD']);

	function parseTitleMetadata(rawTitle) {
		const match = rawTitle.match(TITLE_METADATA_PATTERN);
		if (!match) {
			return { title: rawTitle.trim(), manufacturer: '', type: '', year: null };
		}
		const title = match[1].trim();
		const insideParens = match[2].split(',').map(s => s.trim());

		let manufacturer = '';
		let type = '';
		let year = null;

		for (const piece of insideParens) {
			if (/^\d{4}$/.test(piece)) {
				year = parseInt(piece, 10);
			} else if (KNOWN_TYPES.has(piece)) {
				type = piece;
			} else {
				manufacturer = manufacturer ? `${manufacturer}, ${piece}` : piece;
			}
		}

		return { title, manufacturer, type, year };
	}

	function decadeForYear(year) {
		if (!year) return null;
		return `${Math.floor(year / 10) * 10}s`;
	}

	function parseGameList(htmlText) {
		const doc = new DOMParser().parseFromString(htmlText, 'text/html');
		const links = doc.querySelectorAll('a[href$=".html"]');
		const games = [];

		for (const link of links) {
			const href = link.getAttribute('href') || '';
			if (!href.endsWith('.html')) continue;
			if (href.startsWith('http')) continue;
			if (href.includes('#')) continue;
			if (['gamelist.html', 'index.html', 'about.html', 'header.html', 'footer.html', '404.html'].includes(href)) continue;

			const rawText = (link.textContent || '').trim();
			if (!rawText) continue;

			const meta = parseTitleMetadata(rawText);
			const id = href.replace(/\.html$/, '');

			games.push({
				id,
				url: href,
				rawLabel: rawText,
				title: meta.title,
				manufacturer: meta.manufacturer,
				type: meta.type,
				year: meta.year,
				decade: decadeForYear(meta.year),
			});
		}

		return games;
	}

	function isContentEndComment(node) {
		return node.nodeType === Node.COMMENT_NODE
			&& (node.nodeValue || '').trim().toLowerCase().startsWith('end of content');
	}

	function isIframeNode(node) {
		return node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IFRAME';
	}

	function isHeading(node) {
		return node.nodeType === Node.ELEMENT_NODE && /^H[123]$/.test(node.tagName);
	}

	function isContentBlock(node) {
		if (node.nodeType !== Node.ELEMENT_NODE) return false;
		return ['P', 'UL', 'OL', 'IMG', 'BLOCKQUOTE', 'PRE', 'TABLE', 'DIV', 'BR'].includes(node.tagName);
	}

	function extractImageInfo(element) {
		const img = element.tagName === 'IMG' ? element : element.querySelector('img');
		if (!img) return null;
		return {
			src: img.getAttribute('src') || '',
			alt: img.getAttribute('alt') || '',
		};
	}

	function parseGamePage(htmlText) {
		const doc = new DOMParser().parseFromString(htmlText, 'text/html');
		const body = doc.body;
		if (!body) {
			return { title: '', manufacturer: '', year: null, sections: [], image: null };
		}

		const h1 = body.querySelector('h1');
		const rawTitle = h1 ? (h1.textContent || '').trim() : '';
		const meta = parseTitleMetadata(rawTitle);

		const sections = [];
		let currentSection = null;
		let image = null;

		const finishSection = () => {
			if (currentSection && currentSection.contentHtml.trim()) {
				sections.push(currentSection);
			} else if (currentSection) {
				sections.push(currentSection);
			}
			currentSection = null;
		};

		for (const node of Array.from(body.childNodes)) {
			if (isContentEndComment(node)) break;
			if (isIframeNode(node)) continue;
			if (node === h1) continue;

			if (isHeading(node)) {
				finishSection();
				currentSection = {
					level: parseInt(node.tagName.substring(1), 10),
					heading: (node.textContent || '').trim(),
					contentHtml: '',
				};
				continue;
			}

			if (isContentBlock(node)) {
				const imgInfo = extractImageInfo(node);
				if (imgInfo && !image) image = imgInfo;

				if (currentSection) {
					currentSection.contentHtml += node.outerHTML;
				} else {
					sections.unshift({
						level: 2,
						heading: '',
						contentHtml: node.outerHTML,
					});
				}
			}
		}
		finishSection();

		return {
			title: meta.title,
			manufacturer: meta.manufacturer,
			year: meta.year,
			type: meta.type,
			sections,
			image,
		};
	}

	window.Parser = {
		parseGameList,
		parseGamePage,
		parseTitleMetadata,
		decadeForYear,
	};
})();

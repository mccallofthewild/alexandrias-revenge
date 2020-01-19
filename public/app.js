(() => {
	const graphql = (...templateLiteral) => async (variables = {}) => {
		const response = await fetch('/graphql', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
				// Authorization: `Bearer ${authToken}`
			},
			body: JSON.stringify({
				query: String.raw(...templateLiteral),
				variables
			})
		});
		const json = await response.json();
		if (json.errors) {
			throw json.errors;
		}
		return {
			...json.data,
			__response: response
		};
	};

	// GraphQL
	const fragments = {
		article: /* GraphQL */ `
			fragment article on ParseResult {
				id
				type
				content
				author
				title
				sample
				publishedAt
				textDirection
				wordCount
				heroImageUrl
				afinnSentimentScore
				originUrl
				archivedAt
				readingTimeInMs
				humanReadableSentiment
			}
		`
	};

	window.customElements.define(
		'time-ago',
		class extends HTMLElement {
			get dateObject() {
				const dateTimeString = this.getAttribute('datetime');
				return new Date(dateTimeString);
			}
			get timeAgo() {
				const msAgo = [Date.now() - this.dateObject.getTime(), 'milliseconds'];
				const sAgo = [msAgo[0] / 1000, 'seconds'];
				const mAgo = [sAgo[0] / 60, 'minutes'];
				const hAgo = [mAgo[0] / 60, 'hours'];
				const dAgo = [hAgo[0] / 24, 'days'];
				return [[1, 'moment'], sAgo, mAgo, hAgo, dAgo]
					.reverse()
					.filter(time => time[0] >= 1)
					.map(([num, str]) => [(~~num).toString(), str])[0]
					.join(' ');
			}
			renderTimeAgo() {
				this.innerHTML = this.timeAgo;
			}
			recursiveUpdate() {
				this.renderTimeAgo();
				setTimeout(() => {
					if (!this.isConnected) {
						return;
					}
					this.recursiveUpdate();
				}, 500);
			}
			connectedCallback() {
				this.recursiveUpdate();
			}
			adoptedCallback() {
				this.recursiveUpdate();
			}
			constructor() {
				super();
				this.innerHTML = 'TIMEAGO!!!';
			}
		}
	);
	// App

	const state = (() => {
		let pendingArticles = JSON.parse(
			window.sessionStorage.getItem('pendingArticles') || '[]'
		);
		return {
			parseResult: null,
			previewHTML: null, // idk
			publishedArchiveId: null,
			get pendingArticles() {
				return pendingArticles;
			},
			set pendingArticles(v) {
				pendingArticles = v;
				window.sessionStorage.setItem('pendingArticles', JSON.stringify(v));
			}
		};
	})();
	class Utils {
		static clearNodeContents(el) {
			var range = document.createRange();
			range.selectNodeContents(el);
			range.deleteContents();
		}
	}
	const refs = {
		urlInput: document.getElementById('url-input'),
		previewArea: document.getElementById('preview-area'),
		archiveButton: document.getElementById('archive-button'),
		donationWalletEl: document.getElementById('donation-wallet'),
		closeButton: document.getElementById('close-button'),
		archivedArticlesList: document.getElementById('archived-articles'),
		analyticsEl: document.getElementById('analytics')
	};
	const methods = {
		startLoading() {
			document.body.setAttribute('loading', 'loading');
		},
		stopLoading() {
			document.body.removeAttribute('loading');
		},
		setArticlePreviewLoaded(bool) {
			if (bool) {
				document.body.setAttribute('article-preview-loaded', 'true');
			} else {
				document.body.removeAttribute('article-preview-loaded');
			}
		},
		setUrlInputValue(str) {
			refs.urlInput.value = str;
		}
	};

	const loaders = {
		async loadArchivedArticles() {
			const { archivedArticles } = await graphql`
				{
					archivedArticles {
						...article
					}
				}
				${fragments.article}
			`();
			return archivedArticles;
		},
		async loadArchivePublishStatus(txId) {
			const { archivePublishStatus } = await graphql`
				query publishStatus($txId: ID!) {
					archivePublishStatus(txId: $txId)
				}
			`({
				txId: txId
			});
			return archivePublishStatus;
		},
		async pollForSuccessfulTransaction(txId) {
			const startTime = Date.now();
			let allowFailure = false;
			while (true) {
				// if over 12 minutes, exit
				if (Date.now() - startTime > 60 * 1000 * 12) {
					allowFailure = true;
				}
				try {
					await new Promise(r => setTimeout(r, 2000));
					const archivePublishStatus = await loaders.loadArchivePublishStatus(
						txId
					);
					if (archivePublishStatus == 'SUCCESS') {
						alert('Successfully archived ' + 'arweave.net/' + txId);
						break;
					}
					if (allowFailure && archivePublishStatus == 'FAILED') {
						alert('Failed to publish archive');
						break;
					}
				} catch (e) {
					console.error(e);
					if (allowFailure) {
						alert('May have failed to publish archive');
						break;
					}
				}
			}
			state.pendingArticles = state.pendingArticles.filter(a => a.id != txId);
			connectors.updateArchivedArticlesList();
		}
	};

	const connectors = {
		async updateArchivedArticlesList() {
			let articles = await loaders.loadArchivedArticles();
			Utils.clearNodeContents(refs.archivedArticlesList);
			articles = [
				...state.pendingArticles.map(a => ({ ...a, isPending: true })),
				...articles
			];
			for (let article of articles) {
				await new Promise(r => setTimeout(r, 250));
				const el = document.createElement('div');
				el.innerHTML = /* html */ `
					<li class="list-item animate slideInUp">
						<a href="https://arweave.net/${article.id}" target="_blank">
							<div
								class="list-item__image"
								style="background-image: url(${article.heroImageUrl}), 
								url(https://source.unsplash.com/collection/9248817/800x450?${article.id});"
							>
							</div>
						
							<div class="list-item__content">
								${
									article.isPending
										? `<p style="color: red;"><b>Pending for <time-ago datetime="${article.archivedAt}"></time-ago></b></p>`
										: ''
								}
								<h3>${article.title}</h3>
								<p>${article.sample}</p>
								${article.author ? `<p>👩‍💻by ${article.author}</p>` : ''}
								${
									article.readingTimeInMs
										? `<p>⏳${~~(
												article.readingTimeInMs /
												1000 /
												60
										  )} Minute Read</p>`
										: ''
								}
								<p>${article.humanReadableSentiment} Mood</p>
								<a href="https://arweave.net/${
									article.id
								}" style="word-break: break-all; color: grey !important;" target="_blank">
									<small>${article.id}</small>
								</a>

							</div>
						</a>
					</li>
				`;
				refs.archivedArticlesList.append(...el.childNodes);
			}
		},
		async renderPreview(e) {
			methods.setArticlePreviewLoaded(false);
			methods.startLoading();
			try {
				refs.previewArea.removeAttribute('src');
				const isURI = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gim.test(
					e.target.value
				);
				if (!isURI) throw 0;
				if (isURI) {
					const scrapeRes = await graphql`
						mutation scrape($url: String!) {
							scrapeWebsite(url: $url) {
								...article
							}
						}
						${fragments.article}
					`({
						url: e.target.value
					});
					state.parseResult = scrapeRes.scrapeWebsite;
					refs.previewArea.setAttribute(
						'src',
						`/preview?url=${encodeURIComponent(state.parseResult.originUrl)}`
					);
				}
				methods.setArticlePreviewLoaded(true);
				connectors.updateArchivedArticlesList();
			} catch (err) {
				switch (err) {
					case 0: {
						break;
					}
					default: {
						alert('failed to render preview for ' + e.target.value);
					}
				}
			}
			methods.stopLoading();
		},
		async archiveParseResult() {
			alert(
				'Archiving ' +
					state.parseResult.title +
					'! Check back in a few minutes while Arweave secures your document to the blockweave.'
			);
			const parseResult = state.parseResult;
			methods.startLoading();
			methods.setArticlePreviewLoaded(false);
			methods.setUrlInputValue('');
			try {
				const publishRes = await graphql`
					${fragments.article}
					mutation archive($parseResult: ParseResultInput!) {
						publishArchive(parseResult: $parseResult) {
							...article
						}
					}
				`({
					parseResult: (({ ...parseResult }) => {
						delete parseResult.humanReadableSentiment;
						delete parseResult.id;
						return parseResult;
					})(state.parseResult)
				});
				state.publishedArchiveId = publishRes.publishArchive.id;
				state.pendingArticles = [
					publishRes.publishArchive,
					...state.pendingArticles
				];
				await connectors.updateArchivedArticlesList();
				await loaders.pollForSuccessfulTransaction(state.publishedArchiveId);
			} catch (e) {
				console.error(e);
			}
			methods.stopLoading();
			methods.setUrlInputValue('');
		}
	};

	async function init() {
		connectors.updateArchivedArticlesList();
		state.pendingArticles.forEach(a =>
			loaders.pollForSuccessfulTransaction(a.id)
		);
		const { donationWallet, usageAnalytics } = await graphql`
			{
				donationWallet {
					address
					balance {
						ar
						winston
					}
				}
				usageAnalytics {
					articleCount
				}
			}
		`();
		refs.donationWalletEl.innerHTML = donationWallet
			? `Donate: ${donationWallet.address} | Balance: ${donationWallet.balance.ar} AR`
			: `Wallet not yet configured. Please wait a minute then reload.`;
		refs.analyticsEl.innerHTML = `${usageAnalytics.articleCount} Permanently Stored`;
	}
	init();

	refs.closeButton.addEventListener('click', () => {
		methods.setArticlePreviewLoaded(false);
		state.previewHTML = null;
		state.parseResult = null;
		methods.setUrlInputValue('');
	});
	refs.urlInput.addEventListener('input', async e =>
		connectors.renderPreview(e)
	);

	refs.archiveButton.addEventListener('click', async e =>
		connectors.archiveParseResult(e)
	);
})();

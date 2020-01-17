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
		return await response.json();
	};

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
	const refs = {
		urlInput: document.getElementById('url-input'),
		previewArea: document.getElementById('preview-area'),
		archiveButton: document.getElementById('archive-button'),
		donationAddressEl: document.getElementById('walletDonationAddress'),
		closeButton: document.getElementById('close-button'),
		archivedArticlesList: document.getElementById('archived-articles')
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
			console.log('setting input ', str, refs.urlInput);
			refs.urlInput.value = str;
		}
	};

	const loaders = {
		async loadArchivedArticles() {
			const {
				data: { archivedArticles }
			} = await graphql`
				{
					archivedArticles {
						id
						title
						sample
						author
						humanReadableSentiment
						wordCount
						heroImageUrl
					}
				}
			`();
			return archivedArticles;
		},
		async loadArchivePublishStatus(txId) {
			const {
				data: { archivePublishStatus }
			} = await graphql`
				query publishStatus($txId: ID!) {
					archivePublishStatus(txId: $txId)
				}
			`({
				txId: txId
			});
			return archivePublishStatus;
		},
		async pollForSuccessfulTransaction(txId) {
			let count = 0;
			while (true) {
				if (count++ > 60 * 1000 * 12) {
					alert('Archive process timed out');
				}
				try {
					await new Promise(r => setTimeout(r, 1000));
					const archivePublishStatus = await loaders.loadArchivePublishStatus(
						txId
					);
					console.log(archivePublishStatus);
					if (archivePublishStatus == 'SUCCESS') {
						alert('Successfully archived ' + 'arweave.net/' + txId);
						break;
					}
				} catch (e) {
					console.error(e);
				}
			}
			state.pendingArticles = state.pendingArticles.filter(a => a.id != txId);
			connectors.updateArchivedArticlesList();
		}
	};

	const connectors = {
		async updateArchivedArticlesList() {
			refs.archivedArticlesList.innerHTML = '';
			let articles = await loaders.loadArchivedArticles();
			articles = [...state.pendingArticles, ...articles];
			for (let article of articles) {
				await new Promise(r => setTimeout(r, 250));
				const el = document.createElement('div');
				el.innerHTML = /* html */ `
					<li class="list-item animate slideInUp">
						<a href="https://arweave.net/${article.id}" target="_blank">
							${
								article.heroImageUrl
									? `
									<div
										class="list-item__image"
										style="background-image: url(${article.heroImageUrl});">
									</div>
									`
									: ''
							}
							<div class="list-item__content">
								${article.isPending ? '<p style="color: red;"><b>Pending!</b></p>' : ''}
								<h3>${article.title}</h3>
								<p>📜${article.sample}</p>
								<p>👩‍💻by ${article.author}</p>
								<p style="text-transform: uppercase">${
									article.humanReadableSentiment
								} Sentiment</p>
							</div>
						</a>
					</li>
				`;
				refs.archivedArticlesList.append(...el.childNodes);
			}
		}
	};

	async function init() {
		connectors.updateArchivedArticlesList();
	}
	init();

	(async () => {
		const {
			data: { walletDonationAddress }
		} = await graphql`
			{
				walletDonationAddress
			}
		`();
		refs.donationAddressEl.innerHTML = walletDonationAddress;
		state.pendingArticles.forEach(a =>
			loaders.pollForSuccessfulTransaction(a.id)
		);
	})();

	refs.closeButton.addEventListener('click', () => {
		methods.setArticlePreviewLoaded(false);
		state.previewHTML = null;
		state.parseResult = null;
		methods.setUrlInputValue('');
	});
	refs.urlInput.addEventListener('input', async e => {
		methods.setArticlePreviewLoaded(false);
		methods.startLoading();
		try {
			console.log(e.target.value);
			refs.previewArea.removeAttribute('src');
			const isURI = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gim.test(
				e.target.value
			);
			console.log({ isURI });
			if (!isURI) throw 'not URI';
			if (isURI) {
				const scrapeRes = await graphql`
					mutation scrape($url: String!) {
						scrapeWebsite(url: $url) {
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
						}
					}
				`({
					url: e.target.value
				});
				state.parseResult = scrapeRes.data.scrapeWebsite;
				refs.previewArea.setAttribute(
					'src',
					`/preview?url=${encodeURIComponent(state.parseResult.originUrl)}`
				);
			}
			methods.setArticlePreviewLoaded(true);
			connectors.updateArchivedArticlesList();
		} catch (e) {
			console.error(e);
		}
		methods.stopLoading();
	});

	refs.archiveButton.addEventListener('click', async e => {
		alert(
			'Archiving ' +
				state.parseResult.title +
				'! Check back in a few minutes while Arweave secures your document to the blockweave.'
		);
		const parseResult = state.parseResult;
		methods.startLoading();
		methods.setArticlePreviewLoaded(false);
		methods.setUrlInputValue('');
		const publishRes = await graphql`
			mutation archive($parseResult: ParseResultInput!) {
				publishArchive(parseResult: $parseResult)
			}
		`({
			parseResult: state.parseResult
		});
		console.log(publishRes);
		state.publishedArchiveId = publishRes.data.publishArchive;
		state.pendingArticles = [
			{
				id: state.publishedArchiveId,
				title: parseResult.title,
				sample: parseResult.sample,
				author: parseResult.author,
				humanReadableSentiment: '...',
				wordCount: parseResult.wordCount,
				heroImageUrl: parseResult.heroImageUrl,
				isPending: true
			},
			...state.pendingArticles
		];
		await connectors.updateArchivedArticlesList();
		await loaders.pollForSuccessfulTransaction(state.publishedArchiveId);
		methods.stopLoading();
		methods.setUrlInputValue('');
	});
})();

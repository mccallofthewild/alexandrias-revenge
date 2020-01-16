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

	const state = {
		parseResult: null,
		previewHTML: null, // idk
		publishedArchiveId: null
	};
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
			refs.urlInput.setAttribute('value', str);
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
		async loadArchivePublishStatus() {
			const {
				data: { archivePublishStatus }
			} = await graphql`
				query publishStatus($txId: ID!) {
					archivePublishStatus(txId: $txId)
				}
			`({
				txId: state.publishedArchiveId
			});
			return archivePublishStatus;
		}
	};

	const connectors = {
		async updateArchivedArticlesList() {
			refs.archivedArticlesList.innerHTML = '';
			const articles = await loaders.loadArchivedArticles();
			for (let article of articles) {
				refs.archivedArticlesList.innerHTML += /* html */ `
					<li class="list-item">
						<div class="list-item__image" style="background-image: url(${article.heroImageUrl});"></div>
						<div class="list-item__content">
							<h3>${article.title}</h3>
							<p>${article.sample}</p>
							<p>by ${article.author}</p>
							<p style="text-transform: uppercase">${article.humanReadableSentiment} Sentiment</p>
						</div>
					</li>
				`;
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
				state.previewHTML = previewRes.data.archivePreview;
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
		alert('archiving ' + state.parseResult.title);
		methods.startLoading();
		const publishRes = await graphql`
			mutation archive($parseResult: ParseResultInput!) {
				publishArchive(parseResult: $parseResult)
			}
		`({
			parseResult: state.parseResult
		});
		console.log(publishRes);
		state.publishedArchiveId = publishRes.data.publishArchive;
		let count = 0;
		while (true) {
			if (count++ > 1000) break;
			try {
				await new Promise(r => setTimeout(r, 1000));
				const archivePublishStatus = await loaders.loadArchivePublishStatus();
				console.log(archivePublishStatus);
				if (archivePublishStatus == 'SUCCESS') {
					alert(
						'Successfully archived ' + 'arweave.net/' + state.publishedArchiveId
					);
					break;
				}
			} catch (e) {
				console.error(e);
			}
		}
		methods.stopLoading();
		methods.setUrlInputValue('');
	});
})();

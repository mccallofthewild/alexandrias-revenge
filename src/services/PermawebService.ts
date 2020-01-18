import Arweave from 'arweave/node';
import cheerio from 'cheerio';
import { JWKInterface } from 'arweave/node/lib/wallet';
import Transaction, { Tag } from 'arweave/node/lib/transaction';
import { Archive } from '../@types/Archive';
import fetch from 'cross-fetch';
import { ReaderService } from './ReaderService';
import DataLoader from 'dataloader';
import { UltraArQL, UltraArQLQuery } from '../utils/UltraArQL';

const arweave = Arweave.init({
	host: 'arweave.net',
	protocol: 'https'
});

const txDataLoader = new DataLoader<string, Transaction>(async ids => {
	return await Promise.all(ids.map(id => arweave.transactions.get(id)));
});
export class PermawebService {
	static arweave = arweave;
	loadWallet: () => Promise<JWKInterface>;
	constructor({ loadWallet }: { loadWallet: () => Promise<JWKInterface> }) {
		this.loadWallet = loadWallet;
	}
	private DefaultTags = {
		'App-Name': 'AlexandriasRevenge',
		'App-Version': '1.0.0'
	};

	static async search(query: UltraArQLQuery) {
		const txIds = await arweave.arql(
			UltraArQL.objToArql({
				...query,
				'App-Name': this.DefaultTags['App-Name']
			})
		);
		const txs = await Promise.all(txIds.map(id => txDataLoader.load(id)));
		const objectsFromTx = txs.map(tx => {
			return {
				...this.tagsToProps(tx.tags),
				__transaction: tx
			};
		});
		return objectsFromTx;
	}

	static async getHumanReadableTransactionStatus(txId: string) {
		const txInfo = await this.arweave.transactions.getStatus(txId);
		if (txInfo.confirmed) {
			return 'SUCCESS';
		} else if (txInfo.status.toString().startsWith('2')) {
			return 'PENDING';
		} else if (txInfo.status == 404) {
			return 'PENDING';
		} else {
			return 'FAILED';
		}
	}

	private addTags(tx: Transaction, source: object) {
		for (let [name, value] of this.propsToTags(source)) {
			tx.addTag(name, value);
		}
	}
	private propsToTags(obj: object) {
		return Object.entries(obj).map(([prop, value = null]) => {
			const isPrimitive = (test: any) => test !== Object(test);
			const formattedValue = isPrimitive(value) ? value : JSON.stringify(value);
			return [prop, formattedValue];
		});
	}

	private static tagsToProps(tags: Tag[]) {
		const entries = tags.map(tag => {
			const name = tag.get('name', { decode: true, string: true });
			let value = PermawebService.getVal(tag);
			try {
				value = JSON.parse(value);
			} catch (e) {}
			return [name, value];
		});
		return Object.fromEntries(entries);
	}

	private async archiveImageFromUrl(url: string) {
		const res = await fetch(url);
		const data = await res.arrayBuffer();
		const tx = await arweave.createTransaction(
			{
				data: new Uint8Array(data)
			},
			await this.loadWallet()
		);
		this.addTags(tx, {
			...this.DefaultTags,
			'Content-Type': res.headers.get('Content-Type') || 'image'
		});
		const signedTx = await arweave.transactions.sign(
			tx,
			await this.loadWallet()
		);
		const txPostRes = await arweave.transactions.post(tx);
		const txData = JSON.parse(txPostRes.config.data);
		return txData.id;
	}

	async publish(txDraft: {
		tags: {
			[key: string]: string;
		};
		data: string | Uint8Array | undefined;
		contentType?: string;
	}): Promise<Transaction> {
		txDraft.contentType = txDraft.contentType || 'text/plain';
		const tx = await arweave.createTransaction(
			{
				data: txDraft.data
			},
			await this.loadWallet()
		);
		this.addTags(tx, {
			...txDraft.tags,
			'Content-Type': txDraft.contentType,
			...this.DefaultTags
		});
		await arweave.transactions.sign(tx, await this.loadWallet());
		const txData = await arweave.transactions.post(tx);
		const { id: txId } = JSON.parse(txData.config.data);
		if (txId == tx.id) {
			return tx;
		}
		throw new Error('Failed to publish');
	}

	async publishArticle({
		...article
	}: Archive.Article): Promise<Archive.Article> {
		if (article.heroImageUrl) {
			article.heroImageUrl =
				'https://arweave.net/' +
				(await this.archiveImageFromUrl(article.heroImageUrl));
		}
		const { content, ...tagData } = article;
		const tx = await arweave.createTransaction(
			{
				data: await ReaderService.renderPageFromTemplate(article)
			},
			await this.loadWallet()
		);
		this.addTags(tx, {
			...tagData,
			'Content-Type': 'text/html',
			...this.DefaultTags
		});
		await arweave.transactions.sign(tx, await this.loadWallet());
		const txData = await arweave.transactions.post(tx);
		const { id: txId } = JSON.parse(txData.config.data);
		if (txId == tx.id) {
			return this.txToArticle(tx);
		}
		throw new Error('Article ' + article.originUrl + ' Failed to publish');
	}

	static getVal(tag: Tag) {
		let val;
		try {
			val = tag.get('value', { decode: true, string: true });
		} catch (e) {
			val = tag.get('value');
		}
		return val;
	}
	txToArticle(tx: Transaction): Archive.Article {
		const article = PermawebService.tagsToProps(tx.tags);
		article.id = tx.id;
		article.content = tx.get('data', { decode: true, string: true });
		return article;
	}

	async loadAllArticles() {
		const query = UltraArQL.objToArql({
			// 'Content-Type': 'text/html'
			type: 'Article',
			'App-Name': this.DefaultTags['App-Name']
		});
		const txIds = await arweave.arql(query);
		const txs = await Promise.all(txIds.map(id => txDataLoader.load(id)));
		const instance = this;
		return {
			get articles() {
				return txs.map(tx => instance.txToArticle(tx));
			},
			transactions: txs
		};
	}
}

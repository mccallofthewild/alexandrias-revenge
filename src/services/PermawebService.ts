import Arweave from 'arweave/node';
import cheerio from 'cheerio';
import { JWKInterface } from 'arweave/node/lib/wallet';
import Transaction from 'arweave/node/lib/transaction';
import { Archive } from '../@types/Archive';
import fetch from 'cross-fetch';
import { ReaderService } from './ReaderService';
const arweave = Arweave.init({
	host: 'arweave.net',
	protocol: 'https'
});

export class PermawebService {
	static arweave = arweave;
	wallet: JWKInterface;
	constructor({ wallet }: { wallet: JWKInterface }) {
		this.wallet = wallet;
	}
	private DefaultTags = {
		'App-Name': "Alexandria's Revenge ----- TEST",
		'App-Version': '1.0.0'
	};

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

	private tagsToProps(tags: { name: string; value: string }[]) {
		const entries = tags.map(({ name, value }) => {
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
			this.wallet
		);
		this.addTags(tx, {
			...this.DefaultTags,
			'Content-Type': res.headers.get('Content-Type') || 'image'
		});
		const signedTx = await arweave.transactions.sign(tx, this.wallet);
		const txPostRes = await arweave.transactions.post(tx);
		const txData = JSON.parse(txPostRes.config.data);
		return txData.id;
	}

	async publishArticle({ ...article }: Archive.Article): Promise<string> {
		const uploaded_on = new Date();
		const { content, ...tagData } = article;
		if (tagData.heroImageUrl) {
			tagData.heroImageUrl =
				'https://arweave.net/' +
				(await this.archiveImageFromUrl(tagData.heroImageUrl));
		}
		const tx = await arweave.createTransaction(
			{
				data: await ReaderService.renderPageFromTemplate(article)
			},
			this.wallet
		);
		this.addTags(tx, {
			...tagData,
			'Content-Type': 'text/html',
			...this.DefaultTags
		});
		await arweave.transactions.sign(tx, this.wallet);
		const txData = await arweave.transactions.post(tx);
		const { id: txId } = JSON.parse(txData.config.data);
		return txId;
	}
}

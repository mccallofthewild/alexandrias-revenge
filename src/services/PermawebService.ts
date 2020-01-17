import Arweave from 'arweave/node';
import cheerio from 'cheerio';
import { JWKInterface } from 'arweave/node/lib/wallet';
import Transaction, { Tag } from 'arweave/node/lib/transaction';
import { Archive } from '../@types/Archive';
import fetch from 'cross-fetch';
import { ReaderService } from './ReaderService';
import DataLoader from 'dataloader';

const arweave = Arweave.init({
	host: 'arweave.net',
	protocol: 'https'
});

const txDataLoader = new DataLoader<string, Transaction>(async ids => {
	return await Promise.all(ids.map(id => arweave.transactions.get(id)));
});
export class PermawebService {
	static arweave = arweave;
	wallet: JWKInterface;
	constructor({ wallet }: { wallet: JWKInterface }) {
		this.wallet = wallet;
	}
	private DefaultTags = {
		'App-Name': 'AlexandriasRevenge',
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
		if (article.heroImageUrl) {
			article.heroImageUrl =
				'https://arweave.net/' +
				(await this.archiveImageFromUrl(article.heroImageUrl));
		}
		const uploaded_on = new Date();
		const { content, ...tagData } = article;
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

	async loadAllArticles() {
		const query = UltraArQL.objToArql({
			// 'Content-Type': 'text/html'
			type: 'Article',
			'App-Name': this.DefaultTags['App-Name']
		});
		const txIds = await arweave.arql(query);
		const txs = await Promise.all(txIds.map(id => txDataLoader.load(id)));
		const getVal = (tag: Tag) => {
			let val;
			try {
				val = tag.get('value', { decode: true, string: true });
			} catch (e) {
				val = tag.get('value');
			}
			return val;
		};

		const articles = txs.map(tx => {
			const article = this.tagsToProps(
				tx.tags.map(tag => ({
					name: tag.get('name', { decode: true, string: true }),
					value: getVal(tag)
				}))
			);
			article.id = tx.id;
			article.content = tx.get('data', { decode: true, string: true });
			return article;
		});
		// console.table(articles);

		return articles;
	}
}

type Primitive = string | number | boolean | null | undefined;
type UltraArQLQuery =
	| ({
			[key: string]: Primitive;
	  } & {
			AND?: UltraArQLQuery[];
			OR?: UltraArQLQuery[];
	  })
	| Primitive;
class UltraArQL {
	static objToArql(obj: UltraArQLQuery) {
		// (recursive call) process filter values
		if (typeof obj != 'object' || obj == null || obj instanceof Array) {
			return obj;
		}
		// filter out undefined values
		const entries = Object.entries(obj).filter(([key, val]) => {
			return val !== undefined;
		});

		// turn top level queries into flat array of queries and recursively process sub-queries
		const queries = entries.map(([prop, val]) => {
			/*
        when OR statement, need to take this:
        OR: [{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}]
        and turn it into a recursive arql structure
      */
			if (prop == 'OR' || prop == 'AND') {
				const logicalQueries = ((val as unknown) as UltraArQLQuery[]).map(
					filter => this.objToArql(filter)
				);
				return this.buildArqlTree(logicalQueries, {
					operator: prop.toLowerCase()
				});
			}
			return {
				op: 'equals',
				expr1: this.objToArql(prop),
				expr2: this.objToArql(val)
			};
		});
		return queries.length == 1 ? queries[0] : this.buildArqlTree(queries);
	}

	static buildArqlTree(queries: UltraArQLQuery[], { operator = 'and' } = {}) {
		// because arql queries are limited to two parameters, every query
		const depth = Math.ceil(queries.length ** (1 / 2));
		const buildTree = (currentDepth = 0) => {
			const nextDepth = currentDepth + 1;
			let expr1, expr2;
			if (nextDepth == depth || queries.length <= 2) {
				expr1 = queries.pop();
				expr2 = queries.pop();
			} else {
				expr1 = buildTree(nextDepth);
				expr2 = buildTree(nextDepth);
			}
			return expr2
				? {
						op: operator,
						expr1,
						expr2
				  }
				: {
						op: 'or',
						expr1,
						expr2: expr1
				  };
		};
		return buildTree();
	}
}

import './polyfills';
import fs from 'fs';
import path from 'path';
import { ExpressContext } from 'apollo-server-express/src/ApolloServer';
import {
	ApolloServer,
	gql,
	IResolverObject,
	PubSub
} from 'apollo-server-express';
import { SocketEvents } from './constants/SocketEvents';
import { ReaderService } from './services/ReaderService';
import { Files } from './constants/Files';
import { WalletService } from './services/WalletService';
import { Env } from './constants/Env';
import { PermawebService } from './services/PermawebService';
import Mercury from '@postlight/mercury-parser';
import { Archive } from './@types/Archive';
import express from 'express';
import bodyParser from 'body-parser';
import DataLoader from 'dataloader';
import { ReadingTime } from './utils/ReadingTime';
import { Encrypt } from './utils/Encrypt';
import { JWKInterface } from 'arweave/node/lib/wallet';
const packageJSON = require('../package.json');

if (Env.NODE_ENV == 'development') {
	if (fs.existsSync(path.join(__dirname, '../env.json'))) {
		const devEnv = require('../env.json');
		for (let prop in devEnv) {
			process.env[prop] = devEnv[prop];
		}
	} else {
		console.log(
			`An env.json file is recommended for local development. \n\ See README.md for more information.`
		);
	}
	let didUpdateWalletFile = false;
	try {
		didUpdateWalletFile = WalletService.updateEncryptedWalletFile();
	} catch (e) {}
	if (!didUpdateWalletFile) {
		console.log(
			`A wallet.json file is recommended for local development. \n\ See README.md for more information.`
		);
	}
}

const logArticle = ({ ...article }) => {
	delete article.content;
};

WalletService.loadWallet().catch(console.error);
const permawebService = new PermawebService({
	async loadWallet() {
		return WalletService.loadWallet();
	}
});

// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.
const typeDefs = gql`
	${fs.readFileSync(path.resolve(__dirname, '../schema.graphql'))}
`;

const resolvers: {
	Query: IResolverObject<any, ContextType, any>;
	Mutation: IResolverObject<any, ContextType, any>;
	[key: string]: IResolverObject<any, ContextType, any>;
} = {
	ParseResult: {
		readingTimeInMs(parent) {
			if (!parent.readingTimeInMs) {
				return ReaderService.analyzeHtmlText(parent.content).readingTimeInMs;
			}
			return parent.readingTimeInMs;
		},
		humanReadableSentiment(parent) {
			return !parent.afinnSentimentScore
				? 'Unclear'
				: parent.afinnSentimentScore < -50
				? '☹️ Very Gloomy'
				: parent.afinnSentimentScore < -25
				? '😕 Unhappy'
				: parent.afinnSentimentScore < 25
				? '😐 Alright'
				: parent.afinnSentimentScore < 50
				? '🙂 Happy'
				: `😁 Wonderful`;
		}
	},
	WalletInfo: {
		async balance(parent) {
			const winstonBalance = await PermawebService.arweave.wallets.getBalance(
				parent.address
			);
			return {
				ar: PermawebService.arweave.ar.winstonToAr(winstonBalance),
				winston: winstonBalance
			};
		}
	},
	Query: {
		async donationWallet() {
			let wallet: JWKInterface | undefined;
			await new Promise(r => {
				let timeout = setTimeout(() => {
					if (!wallet) r();
				}, 3000);
				permawebService
					.loadWallet()
					.then(walletJWK => {
						clearTimeout(timeout);
						r();
						wallet = walletJWK;
					})
					.catch(console.error);
			});
			if (!wallet) {
				console.log('has not loaded wallet!');
				return null;
			}
			const address = await PermawebService.arweave.wallets.jwkToAddress(
				wallet
			);
			return { address };
		},
		async usageAnalytics() {
			const { transactions } = await permawebService.loadAllArticles();
			return {
				articleCount: transactions.length
			};
		},
		async archivePreview(
			parent,
			{ parseResult: parsed }: { parseResult: Archive.Article }
		) {
			return ReaderService.renderPageFromTemplate(parsed);
		},
		async archivePublishStatus(parent, { txId }: { txId: string }) {
			return await PermawebService.getHumanReadableTransactionStatus(txId);
		},
		async walletDonationAddress() {
			const address = await PermawebService.arweave.wallets.jwkToAddress(
				await permawebService.loadWallet()
			);
			return address;
		},
		async archivedArticles() {
			const { articles } = await permawebService.loadAllArticles();
			return articles;
		}
	},
	Mutation: {
		async publishEncryptedWalletForPeer(
			parent,
			{
				encryptedWalletJWK,
				walletIdentifier
			}: { encryptedWalletJWK: string; walletIdentifier: string }
		) {
			const tx = await permawebService.publish({
				tags: {
					walletIdentifier: walletIdentifier
				},
				data: encryptedWalletJWK
			});
			return tx.id;
		},
		async scrapeWebsite(parent, { url }, ctx) {
			const parsed = await ReaderService.parse(url);
			return parsed;
		},
		async publishArchive(
			parent,
			{ parseResult: parsed }: { parseResult: Archive.Article },
			ctx
		) {
			const article = await permawebService.publishArticle(parsed);
			logArticle(article);
			return article;
		}
	}
};

const context = (expCtx: ExpressContext) => {
	return {};
};

export type ContextType = ReturnType<typeof context>;

const server = new ApolloServer({
	typeDefs,
	resolvers,
	context,
	introspection: true,
	playground: true
});

server.setGraphQLPath('/graphql');

const PORT = process.env.PORT || 4000;

const app = express();

app.use(
	bodyParser.urlencoded({
		limit: '50mb',
		extended: true,
		parameterLimit: 500000
	})
);

app.use(bodyParser.json({ limit: '50mb' }));

app.get('/preview', async (req, res) => {
	res.send(
		await ReaderService.renderPageFromTemplate(
			await ReaderService.parse(req.query.url)
		)
	);
});

server.applyMiddleware({ app });

app.use(express.static('public'));

// The `listen` method launches a web server.
app.listen({ port: PORT }, () => {
	console.log(`🚀  Server ready at ${PORT}`);
});

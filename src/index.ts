import './polyfills';
import { ApolloServer, gql, IResolverObject, PubSub } from 'apollo-server';
import fs from 'fs';
import path from 'path';
import { ExpressContext } from 'apollo-server-express/src/ApolloServer';
import { SocketEvents } from './constants/SocketEvents';
import { ReaderService } from './services/ReaderService';
import { Files } from './constants/Files';
import { WalletService } from './services/WalletService';
import { Env } from './constants/Env';
import { PermawebService } from './services/PermawebService';
import Mercury from '@postlight/mercury-parser';
import { Archive } from './@types/Archive';

if (Env.NODE_ENV == 'development') {
	const devEnv = require('../env.json');
	for (let prop in devEnv) {
		process.env[prop] = devEnv[prop];
	}
}

if (Env.NODE_ENV == 'development' && fs.existsSync(Files.WALLET_PATH)) {
	WalletService.encryptFile(Files.WALLET_PATH, Files.ENCRYPTED_WALLET_PATH);
}

const permawebService = new PermawebService({
	wallet: JSON.parse(WalletService.decryptFile(Files.ENCRYPTED_WALLET_PATH))
});

// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.
const typeDefs = gql`
	${fs.readFileSync(path.resolve(__dirname, '../schema.graphql'))}
`;

const pubsub = new PubSub();

const resolvers: {
	Query: IResolverObject<any, ContextType, any>;
	Mutation: IResolverObject<any, ContextType, any>;
} = {
	Query: {
		async archivePreview(
			parent,
			{ parseResult: parsed }: { parseResult: Archive.Article }
		) {
			return ReaderService.renderPageFromTemplate(parsed);
		},
		async archivePublishStatus(parent, { txId }: { txId: string }) {
			const txInfo = await PermawebService.arweave.transactions.getStatus(txId);
			if (txInfo.status.toString().startsWith('2')) {
				if (txInfo.confirmed) {
					return 'SUCCESS';
				}
				return 'PENDING';
			}
			return txInfo.status == 404 ? 'PENDING' : 'FAILED';
		},
		async walletDonationAddress() {
			const address = await PermawebService.arweave.wallets.jwkToAddress(
				permawebService.wallet
			);
			return address;
		}
	},
	Mutation: {
		async scrapeWebsite(parent, { url }, ctx) {
			const parsed = await ReaderService.parse(url);
			return parsed;
		},
		async publishArchive(
			parent,
			{ parseResult: parsed }: { parseResult: Archive.Article },
			ctx
		) {
			const txId = await permawebService.publishArticle(parsed);
			return txId;
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
	context
});

server.setGraphQLPath('/graphql');

// The `listen` method launches a web server.
server.listen({ port: process.env.PORT || 4000 }).then(({ url, ...rest }) => {
	console.log(`🚀  Server ready at ${url}`);
});

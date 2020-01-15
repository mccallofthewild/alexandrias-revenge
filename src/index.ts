import './polyfills';
import { ApolloServer, gql, IResolverObject } from 'apollo-server';
import fs from 'fs';
import path from 'path';
import { ExpressContext } from 'apollo-server-express/src/ApolloServer';

const uuidv4 = require('uuid/v4');
// A schema is a collection of type definitions (hence "typeDefs")
// that together define the "shape" of queries that are executed against
// your data.
const typeDefs = gql`
	${fs.readFileSync(path.resolve(__dirname, '../schema.graphql'))}
`;

const resolvers: {
	Query: IResolverObject<any, ContextType, any>;
	Mutation: IResolverObject<any, ContextType, any>;
} = {
	Query: {
		// books: (parent, args, ctx) => books
	},
	Mutation: {
		// async createNote(p, { note }, { pool, sql }) {}
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

// The `listen` method launches a web server.
server.listen().then(({ url, ...rest }) => {
	console.log(`🚀  Server ready at ${url}`);
});

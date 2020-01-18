import fetch from 'cross-fetch';

type QueryString = [TemplateStringsArray, ...any[]];
export class GraphQL {
	static createRequester(endpointURI: string) {
		return (...templateLiteralQuery: QueryString) => async (variables = {}) => {
			const response = await fetch(endpointURI, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json'
					// Authorization: `Bearer ${authToken}`
				},
				body: JSON.stringify({
					query: String.raw(...templateLiteralQuery),
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
	}
}

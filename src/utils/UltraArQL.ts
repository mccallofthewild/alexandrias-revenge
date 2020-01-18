type Primitive = string | number | boolean | null | undefined;
export type UltraArQLQuery = {
	[key: string]: Primitive;
} & {
	AND?: UltraArQLQuery[];
	OR?: UltraArQLQuery[];
};
type RecursiveUltrArQLQuery = UltraArQLQuery | Primitive;
export class UltraArQL {
	static objToArql(obj: RecursiveUltrArQLQuery) {
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
				const logicalQueries = ((val as unknown) as RecursiveUltrArQLQuery[]).map(
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

	static buildArqlTree(
		queries: RecursiveUltrArQLQuery[],
		{ operator = 'and' } = {}
	) {
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

type Primitive = string | number | boolean | null | undefined;
export interface UltraArQLQuery {
	AND?: UltraArQLQuery[];
	OR?: UltraArQLQuery[];
	[key: string]: Primitive | UltraArQLQuery[];
}

type ArQLOperator = 'equals' | 'and' | 'or';

interface AndOrArQLQuery {
	op: 'and' | 'or';
	expr1: ArQLQuery;
	expr2: ArQLQuery;
}
type ArQLQuery =
	| {
			op: 'equals';
			expr1: Primitive;
			expr2: Primitive;
	  }
	| AndOrArQLQuery;

type RecursiveUltrArQLQuery = UltraArQLQuery | Primitive | Array<UltraArQL>;
export class UltraArQL {
	static objToArql(obj: RecursiveUltrArQLQuery): RecursiveUltrArQLQuery {
		// (recursive call) process filter values
		if (typeof obj != 'object' || obj == null || obj instanceof Array) {
			return obj;
		}
		// filter out undefined values
		const entries = Object.entries(obj).filter(([key, val]) => {
			return val !== undefined;
		});

		// turn top level queries into flat array of queries and recursively process sub-queries
		const queries: RecursiveUltrArQLQuery[] = entries.map(([prop, val]) => {
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
					operator: prop.toLowerCase() as ArQLOperator
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
		{ operator = 'and' }: { operator?: ArQLOperator } = {}
	) {
		// because arql queries are limited to two parameters, every query
		const depth = Math.ceil(queries.length ** (1 / 2));
		const buildTree = (currentDepth = 0): ArQLQuery => {
			const nextDepth = currentDepth + 1;
			type Expression = ArQLQuery | undefined;
			let expr1: Expression, expr2: Expression;
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

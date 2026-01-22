import { GraphQLNonNull, GraphQLObjectType, GraphQLString, GraphQLList } from 'graphql'

import { SearchResultType, resolveSearchResults } from './search'

export const RootType = new GraphQLObjectType({
  name: 'Root',
  fields: {
    searchResults: {
      type: new GraphQLList(SearchResultType),
      args: {
        query: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: (obj, args, ctx) => {
        try {
          return resolveSearchResults(ctx, args.query)
        } catch (err) {
          console.log(err)
        }
        return 'No result'
      },
    },
  },
})

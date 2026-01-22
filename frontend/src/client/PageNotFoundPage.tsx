import { PageHeading } from '@gnomad/ui'

import { DocumentTitle } from './UserInterface'
import { InfoPage } from './UserInterface'
import Link from './Link'

const PageNotFoundPage = () => (
  <InfoPage>
    <DocumentTitle title='Not Found' />
    <PageHeading>Page Not Found</PageHeading>
    <p>
      This page does not exist. Try searching for a gene, region, or variant or go to the{' '}
      <Link preserveSelectedDataset={false} to='/'>
        home page
      </Link>
      .
    </p>
  </InfoPage>
)

export default PageNotFoundPage

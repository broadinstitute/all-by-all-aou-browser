import { PageHeading } from '@gnomad/ui'

import { DocumentTitle } from './UserInterface'
import { InfoPage } from './UserInterface'
import Link from './Link'

const GeneNotInAnalysisPage = () => (
  <InfoPage>
    <DocumentTitle title='Not Found' />
    <PageHeading>The gene you searched for is not in the analysis.</PageHeading>
    <p>
      Try again or go to the{' '}
      <Link preserveSelectedDataset={false} to='/'>
        home page
      </Link>
      .
    </p>
  </InfoPage>
)

export default GeneNotInAnalysisPage

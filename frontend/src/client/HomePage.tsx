import styled from 'styled-components'
import { isBrowser } from 'react-device-detect'

import { NewSearchBar } from './Searchbox'
import { DocumentTitle } from './UserInterface'
import { Page, Button, ExternalLink } from '@gnomad/ui'
import { buildStateUrl } from './hooks/useAppNavigation'
import { datasetCounts } from './utils'
import { Link } from 'react-router-dom'

const HomePage = styled(Page)`
  overflow-y: scroll;
  min-width: 100%;
  height: 100%;

  p {
    margin-bottom: 1em;
    line-height: 1.4;
  }
`

const HomeContent = styled(Page)`
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 850px;
  font-size: 16px !important;
  padding-bottom: 100px;
`

const HeadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-bottom: 20px;
  margin-top: 100px;

  h1 {
    padding-top: 0;
    padding-bottom: 0;
    margin-bottom: 20px;
    font-family: GothamBook;
    font-size: 36.8px !important;
    letter-spacing: 2px;
    text-align: center;
    -webkit-text-size-adjust: 100%;
    --fa-font-solid: normal 900 1em/1 "Font Awesome 6 Free";
    --fa-font-regular: normal 400 1em/1 "Font Awesome 6 Free";
    --fa-font-light: normal 300 1em/1 "Font Awesome 6 Pro";
    --fa-font-thin: normal 100 1em/1 "Font Awesome 6 Pro";
    --fa-font-duotone: normal 900 1em/1 "Font Awesome 6 Duotone";
    --fa-font-brands: normal 400 1em/1 "Font Awesome 6 Brands";
    --fa-font-sharp-solid: normal 900 1em/1 "Font Awesome 6 Sharp";
    --fa-font-sharp-regular: normal 400 1em/1 "Font Awesome 6 Sharp";
    --fa-font-sharp-light: normal 300 1em/1 "Font Awesome 6 Sharp";
    --fa-font-sharp-thin: normal 100 1em/1 "Font Awesome 6 Sharp";
    --fa-font-sharp-duotone-solid: normal 900 1em/1 "Font Awesome 6 Sharp Duotone";
    text-rendering: optimizeLegibility;
    box-sizing: border-box;
    scrollbar-width: thin !important;
    scrollbar-color: #d0d0d0 #f1f1f1 !important;
    font-weight: bold;
    font-style: normal;
    font-stretch: normal;
    line-height: 45.36px;
    letter-spacing: normal;
    text-align: center;
    color: ${(props) => props.theme.text};
    margin: 0px;
    padding: 16px;
  }

  h2 {
    margin-top: 20px;
    margin-bottom: 20px;
  }

  #homepage-browse-link {
    font-size: 1.5em;
    font-weight: bold;
    margin-top: 30px;
  }

  .feedback {
    margin-bottom: 10px;
    margin-top: 20px;
    text-align: center;
  }
`

const Version = styled.ul`
  list-style-type: none;
  text-align: center;
  padding-left: 0;
  margin-top: 20px;
  margin-bottom: 30px;
  li {
    font-size: 18px;
    margin-top: 5px;
  }
`

export const browserVersion = process.env.VERSION

const browseResultsUrl = buildStateUrl({
  resultIndex: 'top-associations',
  resultLayout: 'full',
  topResultsTab: 'all-phenotypes',
});

export default function HomePageComponent() {
  return (
    <HomePage>
      <HomeContent>
        <DocumentTitle />
        <HeadingContainer>
          <h1>All by All</h1>
          <p>
            The All by All results map known and novel associations between genotypes and phenotypes using data contributed by <em>All of Us</em> Research Program participants.
          </p>
          {isBrowser ? (
            <>
              <Link to={browseResultsUrl}>
                <Button
                  id='homepage-browse-link'
                  style={{ marginBottom: 20, marginTop: 0, fontSize: 16 }}
                >
                  Browse Results
                </Button>
              </Link>
              <NewSearchBar />
            </>
          ) : <p style={{ marginBottom: 0 }}>
            <strong>This resource does not support data browsing on mobile</strong>.
          </p>
          }
          <p style={{ marginTop: 25 }}>
            <a href="https://www.researchallofus.org/register/?utm_source=nih&utm_medium=referral&utm_campaign=All-by-All-Browser&utm_term=Intro-text&utm_content=Register">
              Register for or log in
            </a> to the <em>All of Us</em> Researcher Workbench to find more details about novel associations, dig deeper into understudied conditions, study potential drug targets, validate findings from other studies by combining associations with individual-level data, and more.
          </p>
          <p>Questions? Contact <a href="mailto:support@researchallofus.org">support@researchallofus.org</a>.</p>

          <Version>
            <li>
              <strong>Dataset:</strong>{" "}
              {Number(datasetCounts["n_samples"]).toLocaleString()} samples,
              {' '}
              {Number(datasetCounts["n_phenotypes"]).toLocaleString()} phenotypes
            </li>
            <li>
              <strong>AoU data release:</strong> CDR v8 (February 2025)
            </li>
            <li>
              <strong>Reference genome:</strong> GRCh38
            </li>
            <li>
              <strong>Browser:</strong> {browserVersion}
            </li>
          </Version>
          <div style={{ display: 'flex', width: '100%' }}>
            <div style={{ flex: 1 }}>
              <h2>Updates:</h2>
              <p>
                <strong><em>Friday, March 13, 2026</em></strong>: The All by All browser has been updated with data from the Curated Data Repository (CDR) version 8 data release (February 2025), expanding to over 3,500 phenotypes across nearly 400,000 whole genome sequences.
              </p>
              <p>
                <strong><em>Friday, January 31, 2025</em></strong>: The <em>All of Us</em> Researcher Workbench team
                released an incremental update for the All by All tables related to the
                Personal and Family Health History (PFHH) and Phecode phenotypes to align
                with data processing and quality assurance. <ExternalLink href="https://support.researchallofus.org/hc/en-us/articles/34401312793748">Visit the User Support Hub for more information</ExternalLink>.
              </p>
            </div>
          </div>
        </HeadingContainer>
      </HomeContent>
    </HomePage>
  );
}

// @ts-nocheck

import React from 'react'
import styled from 'styled-components'
import { PageHeading } from '@gnomad/ui'

import aboutContent from './about/about.md'
import broadInstitute from './about/contributors/broad-institute.md'

import { DocumentTitle } from './UserInterface'
import { InfoPage } from './UserInterface'
import MarkdownContent from './MarkdownContent'

const AboutPage = styled(InfoPage)`
  .logos {
    display: flex;

    margin-top: 30px;
    margin-bottom: 30px;

    flex-direction: row;
    justify-content: space-around;
    align-items: center;

    #pfizer-logo {
      max-width: 13%;
    }

    #broad-logo {
      max-height: 50px;
    }

    img {
      width: 18%;
      max-width: 200px;
    }
  }
`

const CreditsWrapper = styled.div`
  max-width: 70%;

  @media (max-width: 992px) {
    max-width: 95%;
  }
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 50px;

  @media (max-width: 992px) {
    flex-direction: column;
    font-size: 16px;
    margin-top: 0;
  }
`

const Credits = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  font-size: 13px;

  max-width: 1000px;

  @media (max-width: 992px) {
    flex-direction: column;
    font-size: 16px;
  }

  #second-col {
    margin-top: 25px;
  }

  @media (max-width: 992px) {
    #first-col {
      margin-bottom: 0;
    }

    #second-col {
      margin-top: 0;
    }
  }
`

const CreditsSection = styled.div`
  width: calc(${props => props.width} - 15px);

  @media (max-width: 992px) {
    width: 100%;
    margin-bottom: 50px;
  }
`

const Contributors = styled.div`
  line-height: 1.5;

  h2 {
    margin-right: 20px;
    margin-top: 50px;
  }

  @media (max-width: 992px) {
    h2 {
      margin-top: 100px;
    }
  }

  h3 {
    margin-top: 10px;
  }

  ul {
    padding-left: 0;
    margin: 0;
    list-style-type: none;
  }

  ul ul {
    padding-left: 20px;
    margin: 0.5em 0;
  }
`

export default () => (
  <AboutPage>
    <DocumentTitle title="About" />

    <MarkdownContent dangerouslySetInnerHTML={{ __html: aboutContent.html }} />

    {/* <CreditsWrapper> */}
    {/*   <Credits> */}
    {/*     <CreditsSection id="first-col" width="20%"> */}
    {/*       <h2 id="broad-title">Broad Institute</h2> */}
    {/*       <Contributors */}
    {/*         aria-labelledby="broad-institute-contributors" */}
    {/*         dangerouslySetInnerHTML={{ __html: broadInstitute.html }} */}
    {/*       /> */}
    {/*     </CreditsSection> */}
    {/*   </Credits> */}
    {/* </CreditsWrapper> */}
  </AboutPage>
)

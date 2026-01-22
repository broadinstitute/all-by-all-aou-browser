// @ts-nocheck

import React from 'react'
import styled from 'styled-components'

import privacyPolicy from './about/privacy-policy.md'

import { DocumentTitle } from './UserInterface'
import { InfoPage } from './UserInterface'
import Logos from './Logos'
import MarkdownContent from './MarkdownContent'

export default () => (
  <InfoPage>
    <DocumentTitle title="Terms" />

    <MarkdownContent
      dangerouslySetInnerHTML={{ __html: privacyPolicy.html }}
    />
  </InfoPage>
)

// @ts-nocheck

import React from 'react'

import walkthroughContent from './about/walkthrough.md'

import { DocumentTitle } from './UserInterface'
import { InfoPage } from './UserInterface'
import MarkdownContent from './MarkdownContent'

export default () => (
  <InfoPage>
    <DocumentTitle title="Walkthrough" />
    <MarkdownContent dangerouslySetInnerHTML={{ __html: walkthroughContent.html }} />
  </InfoPage>
)

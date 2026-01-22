// @ts-nocheck

import React from 'react'

import { DocumentTitle } from './UserInterface'
import { InfoPage } from './UserInterface'
import MarkdownContent from './MarkdownContent'

import downloadsContent from './about/downloads.md'

export default () => (
  <InfoPage>
    <DocumentTitle title="Downloads" />
    <MarkdownContent
      dangerouslySetInnerHTML={{ __html: downloadsContent.html }}
    />
  </InfoPage>
)

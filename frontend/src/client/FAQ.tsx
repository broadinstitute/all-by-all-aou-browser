// @ts-nocheck

import React from 'react'
import styled from 'styled-components'

import faqContent from './about/faq.md'

import { DocumentTitle } from './UserInterface'
import { InfoPage } from './UserInterface'
import MarkdownContent from './MarkdownContent'

const FAQPage = styled(InfoPage)`
  padding-bottom: 60px;
`

const FAQContent = styled(MarkdownContent)`
  h1 {
    margin-bottom: 30px;
  }

  /* Style bold question text as visually distinct headers */
  p > strong:first-child:last-child {
    display: block;
    font-size: 1.1em;
    margin-top: 35px;
    padding-top: 20px;
    border-top: 1px solid ${props => props.theme?.border || '#e0e0e0'};
    color: ${props => props.theme?.text || 'inherit'};
  }

  /* First question doesn't need a top border (h1 already has one) */
  p:first-of-type > strong:first-child:last-child {
    border-top: none;
    padding-top: 0;
    margin-top: 10px;
  }

  /* Sub-sections under limitations */
  h3 {
    font-size: 1em;
    margin-top: 20px !important;
    margin-bottom: 10px;
    color: ${props => props.theme?.textMuted || '#555'};
  }

  blockquote {
    border-left: 3px solid ${props => props.theme?.primary || '#428bca'};
    padding: 10px 20px;
    margin: 15px 0;
    font-style: italic;
    background: ${props => props.theme?.surfaceAlt || 'rgba(0,0,0,0.02)'};
    border-radius: 0 4px 4px 0;
  }
`

export default () => (
  <FAQPage>
    <DocumentTitle title="FAQ" />
    <FAQContent dangerouslySetInnerHTML={{ __html: faqContent.html }} />
  </FAQPage>
)

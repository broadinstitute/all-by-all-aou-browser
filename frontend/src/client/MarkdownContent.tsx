// @ts-nocheck
//
import React from 'react'
import { useHistory } from 'react-router-dom'
import styled from 'styled-components'

const MarkdownContentWrapper = styled.div`
  font-size: 16px;
  max-width: 70%;

  @media (max-width: 992px) {
    max-width: 95%;
  }

  h1,
  h2,
  h3 {
    font-weight: bold;
    margin-bottom: 20px;
    margin-top: 30px !important;
  }

  h4 {
    font-weight: bold !important;
    margin-top: 30px !important;
  }

  h1 {
    font-size: 2em;
    padding-bottom: 5px;
    border-bottom: 1px solid grey;
  }

  h2 {
    font-size: 1.2em;
  }

  p {
    margin-top: 15px;
    margin-bottom: 15px;
    line-height: 1.4;
  }

  a {
    color: #428bca;
    text-decoration: none;
  }

  img {
    max-width: 100%;
  }

  blockquote {
    margin: 0 0 0 10px;
    font-size: 14px;
    font-style: italic;
    line-height: 1.4;
  }

  ol,
  ul {
    padding-left: 20px;
    margin: 1em 0;
  }

  li {
    margin-bottom: 0.5em;
  }

  table {
    border-collapse: collapse;
    border-spacing: 0;
  }

  td {
    padding: 0.5em 10px 0.5em 0;
    border-bottom: 1px solid #ccc;
    font-weight: normal;
    text-align: left;
  }

  th {
    padding: 0.5em 10px 0.5em 0;
    border-bottom: 1px solid #000;
    background-position: center right;
    background-repeat: no-repeat;
    font-weight: bold;
  }

  code {
    display: inline-block;
    overflow-x: scroll;
    box-sizing: border-box;
    max-width: 90vw;
    padding: 0.5em 1em;
    border-radius: 0.25em;
    background: rgb(51, 51, 51) none repeat scroll 0% 0%;
    color: rgb(250, 250, 250);
    font-family: monospace;
    line-height: 1.6;
    white-space: nowrap;
  }

  .video-container {
    position: relative;
    width: 100%;
    height: 0;
    padding-bottom: 56.25%;
  }

  .video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
`

// eslint-disable-next-line react/prop-types
export default props => {
  const history = useHistory()

  /* Hack to make regular anchor elements from Markdown content work with React Router */
  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */
    <MarkdownContentWrapper
      {...props}
      onClick={e => {
        if (e.target.tagName === 'A') {
          const isRelativeLink = e.target.getAttribute('href').startsWith('/')
          if (isRelativeLink) {
            e.preventDefault()
            history.push(e.target.getAttribute('href'))
          }
        }
      }}
    />
  )
}

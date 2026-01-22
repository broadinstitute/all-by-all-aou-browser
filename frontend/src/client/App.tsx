import React from 'react'
import { Route, Switch } from 'react-router-dom'
import styled from 'styled-components'

import { isBrowser } from 'react-device-detect'

import About from './About'
import Downloads from './Downloads'
import GeneNotInAnalysis from './GeneNotInAnalysis'
import HomePage from './HomePage'
import { useMonitorWindowSize } from './monitorWindowSize'
import PageHeading from './PageHeading'
import Walkthrough from './Walkthrough'
import PageNotFoundPage from './PageNotFoundPage'
import { useResetStateOnLocationChange } from './resetState'
import { SplitScreenViewer } from './SplitScreenViewer'
import { StatusBar } from './StatusBar'
import AvailableAnalyses from './PhenotypeList/AvailableAnalyses'
import PrivacyPolicy from './PrivacyPolicy'
import Link from './Link'

import './App.css'
import LogoutButton from './Logout'

const AppStyles = styled.div`
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  grid-template-areas:
    'header'
    'status-bar'
    'main'
    'footer';
  
  height: 100vh;

  overflow-y: hidden;
  overflow-x: hidden;

  header {
    grid-area: header;
  }

  #status-bar {
    grid-area: status-bar;
  }

  main {
    font-family: GothamBook;
    grid-area: main;
    padding-right: 0;
    padding-left: 5px;
    padding-top: 5px;
    overflow-y: hidden;
  }

  footer {
    grid-area: footer;
    background-color: #262262;
    color: white;
    padding: 10px;
    text-align: center;
    z-index: 1;
  }

  h1 {
    margin-top: 0;
    margin-bottom: 10px;
    padding: 0;
    font-weight: bold;

    strong {
      font-weight: bold;
    }
  }

  .app-section-title {
    font-size: 14px;
    margin-top: 0;
    margin-right: 5px;

    background-color: whitesmoke;
    border: 1px solid lightgrey;
    padding: 3px 5px 3px 5px;

    strong {
      font-weight: bold;
    }
  }

  h4 {
    font-weight: normal;
  }

`

const MobileView = styled.div`
  p {
    margin-top: 20px;
    font-size: 1.5em;
    margin-bottom: 10px;
  }
`

const App = ({ showLogout }: { showLogout: boolean }) => {
  useResetStateOnLocationChange()
  useMonitorWindowSize()

  return (
    <React.Fragment>
      <AppStyles>
        <header>
          <PageHeading />
        </header>
        <Switch>
          <Route exact path='/' />
          <Route exact path='/about' />
          <Route exact path='/privacy-policy' />
          {isBrowser && <StatusBar />}
        </Switch>

        <main>
          <Switch>
            <Route exact path='/'>
              <HomePage />
            </Route>
            <Route exact path='/about'>
              <About />
            </Route>
            <Route exact path='/privacy-policy'>
              <PrivacyPolicy />
            </Route>
            <Route exact path='/downloads'>
              <Downloads />
            </Route>
            <Route exact path='/analyses'>
              <AvailableAnalyses />
            </Route>
            <Route exact path="/walkthrough">
              <Walkthrough />
            </Route>
            <Route path='/gene/not-in-analysis' component={GeneNotInAnalysis} />
            <Route path='/app'>
              {isBrowser ? (
                <SplitScreenViewer />
              ) : (
                <MobileView>
                  <p>
                    Sorry! The All by All browser does not yet support browsing on mobile. Please go to your
                    computer to use it.
                  </p>
                  <p>
                    You can check out screenshots in the <Link to='/walkthrough'>walkthrough</Link>{' '}
                    to get a sense of what this resource looks like.
                  </p>
                </MobileView>
              )}
            </Route>
            <Route component={PageNotFoundPage} />
          </Switch>
        </main>
        <footer>
          <p>
            <em>All of Us</em> and the <em>All of Us</em> logo are registered service marks of the <a href="https://www.hhs.gov/">U.S. Department of Health and Human Services</a>. The <em>All of Us</em> platform and the All by All browser are for research only and do not provide medical advice, diagnosis, or treatment. Please review our <Link to="/privacy-policy">Privacy Policy</Link>. Copyright © 2024.
            {showLogout && <LogoutButton />}
          </p>
        </footer>
      </AppStyles>
    </React.Fragment>
  )
}
export default App

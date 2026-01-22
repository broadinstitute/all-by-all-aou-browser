import PropTypes from 'prop-types'
import React, { Component } from 'react'
import { createPortal } from 'react-dom'
import { Manager, Popper, Reference } from 'react-popper'

import { DefaultTooltip } from './DefaultTooltip'
import { Arrow, Container } from './tooltipStyles'

interface Props {
  text: string
  tooltipComponent: any
  children?: React.ReactNode
}

export class TooltipAnchor extends Component<Props> {

  containerElement: HTMLDivElement;

  static propTypes = {
    children: PropTypes.node.isRequired,
    tooltipComponent: PropTypes.func,
  }

  static defaultProps = {
    tooltipComponent: DefaultTooltip,
  }

  state = {
    isVisible: false,
  }

  constructor(props: Props) {
    super(props)
    this.containerElement = document.createElement('div')
  }

  componentDidMount() {
    document.body.appendChild(this.containerElement)
  }

  componentWillUnmount() {
    document.body.removeChild(this.containerElement)
  }

  showTooltip = () => {
    this.setState({ isVisible: true })
  }

  hideTooltip = () => {
    this.setState({ isVisible: false })
  }

  render() {
    const {
      children,
      // https://reactjs.org/docs/jsx-in-depth.html#user-defined-components-must-be-capitalized
      tooltipComponent: TooltipComponent,
      ...otherProps
    } = this.props
    const { isVisible } = this.state

    return (
      <Manager>
        <Reference>
          {({ ref }) =>
            //@ts-expect-error FIXME
            React.cloneElement(React.Children.only(children), {
              onMouseEnter: this.showTooltip,
              onMouseLeave: this.hideTooltip,
              ref,
            })
          }
        </Reference>
        {isVisible &&
          createPortal(
            <Popper placement="top">
              {({ ref, style, placement, arrowProps }) => (
                <Container data-placement={placement} ref={ref} style={style}>
                  <TooltipComponent {...otherProps} />
                  <Arrow data-placement={placement} ref={arrowProps.ref} style={arrowProps.style} />
                </Container>
              )}
            </Popper>,
            this.containerElement
          )}
      </Manager>
    )
  }
}

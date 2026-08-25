import React from 'react'
import styled from 'styled-components'

const TriggerButton = styled.button`
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--theme-primary, #3279b7);
  cursor: pointer;
  font: inherit;
  text-align: left;

  &:hover {
    background: transparent;
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 3px solid var(--theme-primary, #4f46e5);
    outline-offset: 2px;
  }
`

type ContextMenuTriggerProps = {
  children: React.ReactNode
  className?: string
  menuOpen: boolean
  onPrimaryAction: () => void
  onOpenMenu: (position: { x: number; y: number }) => void
  title?: string
}

/** A link-like native button with both primary and context-menu keyboard actions. */
export const ContextMenuTrigger: React.FC<ContextMenuTriggerProps> = ({
  children,
  className,
  menuOpen,
  onPrimaryAction,
  onOpenMenu,
  title,
}) => {
  const openAtTrigger = (trigger: HTMLButtonElement) => {
    const bounds = trigger.getBoundingClientRect()
    onOpenMenu({ x: bounds.left, y: bounds.bottom })
  }

  return (
    <TriggerButton
      type="button"
      className={className}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onClick={onPrimaryAction}
      onContextMenu={(event) => {
        event.preventDefault()
        event.currentTarget.focus()
        onOpenMenu({ x: event.clientX, y: event.clientY })
      }}
      onKeyDown={(event) => {
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault()
          openAtTrigger(event.currentTarget)
        }
      }}
      title={title}
    >
      {children}
    </TriggerButton>
  )
}

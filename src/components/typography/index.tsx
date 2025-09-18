import Box, { BoxProps } from '@mui/material/Box'
import clsx from 'clsx'

// ==============================================================
interface Props extends BoxProps {
  ellipsis?: boolean
}
// ==============================================================

export const H1 = (props: Props) => {
  const { ellipsis, sx, children, className, ...others } = props

  return (
    <Box
      fontSize={48}
      component="h1"
      fontWeight={700}
      {...(className && { className: clsx({ [className]: true }) })}
      sx={{
        ...sx,
        ...(ellipsis && {
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }),
      }}
      {...others}
    >
      {children}
    </Box>
  )
}

export const H2 = (props: Props) => {
  const { ellipsis, children, className, ...others } = props

  return (
    <Box
      fontSize={40}
      component="h2"
      fontWeight={700}
      // ellipsis={ellipsis ? 1 : 0}
      {...(className && { className: clsx({ [className]: true }) })}
      {...others}
    >
      {children}
    </Box>
  )
}

export const H3 = (props: Props) => {
  const { ellipsis, children, className, ...others } = props

  return (
    <Box
      fontSize={36}
      component="h3"
      fontWeight={700}
      // ellipsis={ellipsis ? 1 : 0}
      {...(className && { className: clsx({ [className]: true }) })}
      {...others}
    >
      {children}
    </Box>
  )
}

export const H4 = (props: Props) => {
  const { ellipsis, children, className, ...others } = props

  return (
    <Box
      fontSize={32}
      component="h4"
      fontWeight={600}
      // ellipsis={ellipsis ? 1 : 0}
      {...(className && { className: clsx({ [className]: true }) })}
      {...others}
    >
      {children}
    </Box>
  )
}

export const H5 = (props: Props) => {
  const { ellipsis, children, className, ...others } = props

  return (
    <Box
      fontSize={30}
      component="h5"
      lineHeight={1}
      fontWeight={600}
      // ellipsis={ellipsis ? 1 : 0}
      {...(className && { className: clsx({ [className]: true }) })}
      {...others}
    >
      {children}
    </Box>
  )
}

export const H6 = (props: Props) => {
  const { ellipsis, children, className, ...others } = props

  return (
    <Box
      fontSize={28}
      component="h6"
      fontWeight={600}
      // ellipsis={ellipsis ? 1 : 0}
      {...(className && { className: clsx({ [className]: true }) })}
      {...others}
    >
      {children}
    </Box>
  )
}

export const Paragraph = (props: Props) => {
  const { ellipsis, children, className, ...others } = props

  return (
    <Box
      fontSize={14}
      component="p"
      fontWeight={400}
      // ellipsis={ellipsis ? 1 : 0}
      {...(className && { className: clsx({ [className]: true }) })}
      {...others}
    >
      {children}
    </Box>
  )
}

export const Small = (props: Props) => {
  const { ellipsis = false, children, className, ...others } = props

  return (
    <Box
      fontSize={12}
      component="small"
      fontWeight={400}
      // ellipsis={ellipsis ? 1 : 0}
      {...(className && { className: clsx({ [className]: true }) })}
      {...others}
    >
      {children}
    </Box>
  )
}

export const Span = (props: Props) => {
  const { ellipsis = false, children, className, ...others } = props

  return (
    <Box
      component="span"
      // ellipsis={ellipsis ? 1 : 0}
      {...(className && { className: clsx({ [className]: true }) })}
      {...others}
    >
      {children}
    </Box>
  )
}

export const Tiny = (props: Props) => {
  const { ellipsis = false, children, className, ...others } = props

  return (
    <Box
      component="p"
      fontSize={10}
      fontWeight={400}
      // ellipsis={ellipsis ? 1 : 0}
      {...(className && { className: clsx({ [className]: true }) })}
      {...others}
    >
      {children}
    </Box>
  )
}

import { PropsWithChildren, forwardRef } from 'react'
import { SxProps, Theme, useTheme } from '@mui/material/styles'
import SlickCarousel, { Settings } from 'react-slick'
// LOCAL CUSTOM COMPONENTS
import CarouselDots from './components/carousel-dots'
import CarouselArrows from './components/carousel-arrows'
// STYLED COMPONENT
import { RootStyle } from './styles'

// ==============================================================
interface Props extends PropsWithChildren, Settings {
  dotColor?: string
  spaceBetween?: number
  dotStyles?: SxProps<Theme>
  arrowStyles?: SxProps<Theme>
}
// ==============================================================

const Carousel = forwardRef<SlickCarousel, Props>((props, ref) => {
  const {
    dotColor,
    children,
    arrowStyles,
    dots = true,
    arrows = false,
    slidesToShow = 4,
    spaceBetween = 10,
    dotStyles = { mt: 4 },
    ...others
  } = props

  const theme = useTheme()

  const settings: Settings = {
    dots,
    arrows,
    slidesToShow,
    rtl: theme.direction === 'rtl',
    ...CarouselArrows({ sx: arrowStyles }),
    ...CarouselDots({ dotColor, sx: dotStyles }),
    ...others,
  }

  return (
    <RootStyle space={spaceBetween}>
      <SlickCarousel ref={ref} {...settings}>
        {children}
      </SlickCarousel>
    </RootStyle>
  )
})

export default Carousel

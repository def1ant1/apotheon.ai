import Card from '@mui/material/Card'
import CardMedia from '@mui/material/CardMedia'
import CardContent from '@mui/material/CardContent'
// CUSTOM COMPONENTS
import { H6, Paragraph } from '@/components/typography'
// CUSTOM ICON COMPONENTS
import Edit from '@/icons/Edit'
import Delete from '@/icons/Delete'
// STYLED COMPONENTS
import { ImageWrapper, StyledIconButton } from './styles'

// ==============================================================
interface ProductCardProps {
  handleDelete: (id: string) => void
  product: {
    id: string
    name: string
    image: string
    price: number
    stock: number
    category: string
    published: boolean
    createdAt: string
  }
}
// ==============================================================

export default function ProductCard({ product, handleDelete }: ProductCardProps) {
  const { image, name, price, id } = product || {}

  return (
    <Card sx={{ position: 'relative' }}>
      <ImageWrapper>
        <CardMedia width="100%" height="100%" component="img" alt="Product Image" image={image} />

        <div className="hover-actions">
          <StyledIconButton>
            <Edit className="icon" />
          </StyledIconButton>

          <StyledIconButton onClick={() => handleDelete(id)}>
            <Delete className="icon" />
          </StyledIconButton>
        </div>
      </ImageWrapper>

      <CardContent sx={{ textAlign: 'center', '&:last-child': { pb: 2 } }}>
        <H6 fontSize={14} mb={0.5}>
          {name}
        </H6>

        <Paragraph color="text.secondary">${price}</Paragraph>
      </CardContent>
    </Card>
  )
}

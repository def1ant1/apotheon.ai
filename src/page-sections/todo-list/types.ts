export interface BoardColumn {
  id: string
  name: string
  todoIds: string[]
}

export interface BoardItem {
  id: string
  date: string
  title: string
  description: string
  statusColor: string
  author: { name: string; image: string }
}

export interface Board {
  ordered: string[]
  todos: Record<string, BoardItem>
  columns: Record<string, BoardColumn>
}

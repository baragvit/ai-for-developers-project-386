import { SearchX } from 'lucide-react'
import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { Layout } from '@/components/layout'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { AdminPage } from '@/pages/admin-page'
import { BookPage } from '@/pages/book-page'
import { CatalogPage } from '@/pages/catalog-page'
import { HomePage } from '@/pages/home-page'

function NotFoundPage() {
  return (
    <EmptyState
      icon={<SearchX />}
      title="Страница не найдена"
      description="Похоже, ссылка устарела или в ней опечатка."
      action={
        <Button asChild variant="outline">
          <Link to="/">На главную</Link>
        </Button>
      }
    />
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="book" element={<CatalogPage />} />
          <Route path="book/:eventTypeId" element={<BookPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
